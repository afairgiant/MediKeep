"""
Security Audit Logging Module

This module provides comprehensive security event logging and monitoring
for the Medical Records Management System. It tracks authentication events,
authorization failures, suspicious activities, and compliance-related actions.
"""

import time
from datetime import datetime
from typing import Dict, Optional, Any
from collections import defaultdict
from threading import Lock
import hashlib

from app.core.logging_config import get_logger, log_security_event
from app.core.config import settings


class SecurityAuditManager:
    """
    Manages security audit logging and threat detection for the application.

    Features:
    - Rate limiting detection
    - Failed login attempt tracking
    - Suspicious activity monitoring
    - Data access auditing
    - Compliance logging
    """

    def __init__(self):
        self.security_logger = get_logger(__name__, "security")
        self.audit_logger = get_logger(
            __name__, "audit"
        )  # Thread-safe counters for rate limiting detection
        self._failed_logins = defaultdict(list)  # IP -> [timestamps]
        self._api_requests = defaultdict(list)  # IP -> [timestamps]
        self._lock = Lock()

        # Configuration - respect development security settings
        self.max_failed_logins = 5
        self.failed_login_window = 300  # 5 minutes
        # Higher rate limit in development mode to accommodate frontend batching
        self.max_requests_per_minute = 200 if settings.DEBUG else 60

        # Disable suspicious pattern detection in development if configured
        self.suspicious_patterns = (
            [
                "union",
                "select",
                "drop",
                "delete",
                "insert",
                "update",
                "1=1",
                "1=0",
                "or 1",
                "and 1",
                "--",
                "/*",
                "*/",
                "<script",
                "javascript:",
                "onerror=",
                "onload=",
            ]
            if settings.ENABLE_SUSPICIOUS_INPUT_DETECTION
            else []
        )

    def log_authentication_attempt(
        self,
        username: str,
        ip_address: str,
        user_agent: str,
        success: bool,
        failure_reason: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> None:
        """Log authentication attempts with rate limiting detection."""

        # Skip logging if security audit logging is disabled
        if not settings.ENABLE_SECURITY_AUDIT_LOGGING:
            return

        event_data = {
            "event": "authentication_attempt",
            "username": username,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "success": success,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if user_id:
            event_data["user_id"] = user_id
        if not success:
            event_data["failure_reason"] = failure_reason

            # Track failed login attempts for rate limiting (skip if disabled)
            if settings.ENABLE_FAILED_LOGIN_TRACKING and not settings.DEBUG:
                with self._lock:
                    now = time.time()
                    self._failed_logins[ip_address].append(now)

                    # Clean old entries
                    cutoff = now - self.failed_login_window
                    self._failed_logins[ip_address] = [
                        ts for ts in self._failed_logins[ip_address] if ts > cutoff
                    ]

                    # Check for rate limiting
                    if len(self._failed_logins[ip_address]) >= self.max_failed_logins:
                        self.log_security_threat(
                            "rate_limit_exceeded",
                            ip_address=ip_address,
                            details={
                                "failed_attempts": len(self._failed_logins[ip_address]),
                                "time_window_seconds": self.failed_login_window,
                                "username": username,
                            },
                        )

        log_security_event(self.security_logger, **event_data)

    def log_authorization_failure(
        self,
        user_id: int,
        username: str,
        ip_address: str,
        resource: str,
        action: str,
        reason: str,
    ) -> None:
        """Log authorization failures."""

        log_security_event(
            self.security_logger,
            event="authorization_failure",
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            resource=resource,
            action=action,
            reason=reason,
            timestamp=datetime.utcnow().isoformat(),
        )

    def log_data_access(
        self,
        user_id: int,
        username: str,
        ip_address: str,
        resource_type: str,
        resource_id: Optional[int],
        action: str,
        success: bool,
        details: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log medical data access for audit trail."""

        event_data = {
            "event": "data_access",
            "user_id": user_id,
            "username": username,
            "ip_address": ip_address,
            "resource_type": resource_type,
            "action": action,
            "success": success,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if resource_id:
            event_data["resource_id"] = resource_id

        if details:
            event_data["details"] = details

        # Use audit logger for data access (separate retention policy)
        log_security_event(self.audit_logger, **event_data)

    def log_security_threat(
        self,
        threat_type: str,
        ip_address: str,
        details: Dict[str, Any],
        user_id: Optional[int] = None,
        username: Optional[str] = None,
    ) -> None:
        """Log detected security threats."""

        event_data = {
            "event": "security_threat",
            "threat_type": threat_type,
            "ip_address": ip_address,
            "details": details,
            "timestamp": datetime.utcnow().isoformat(),
            "severity": "HIGH",
        }

        if user_id:
            event_data["user_id"] = user_id
        if username:
            event_data["username"] = username

        log_security_event(self.security_logger, **event_data)

    def check_suspicious_input(
        self,
        input_data: str,
        context: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
    ) -> bool:
        """Check input for suspicious patterns (potential injection attacks)."""

        input_lower = input_data.lower()
        suspicious_found = []

        for pattern in self.suspicious_patterns:
            if pattern in input_lower:
                suspicious_found.append(pattern)

        if suspicious_found:
            self.log_security_threat(
                "suspicious_input_detected",
                ip_address=ip_address or "unknown",
                details={
                    "context": context,
                    "patterns_found": suspicious_found,
                    "input_hash": hashlib.sha256(input_data.encode()).hexdigest()[:16],
                },
                user_id=user_id,
            )
            return True

        return False

    def track_api_request(self, ip_address: str) -> bool:
        """Track API requests for rate limiting. Returns True if rate limit exceeded."""

        # Skip rate limiting if disabled in configuration or debug mode
        if not settings.ENABLE_RATE_LIMITING or settings.DEBUG:
            return False

        with self._lock:
            now = time.time()
            self._api_requests[ip_address].append(now)

            # Clean old entries (older than 1 minute)
            cutoff = now - 60
            self._api_requests[ip_address] = [
                ts for ts in self._api_requests[ip_address] if ts > cutoff
            ]

            # Check rate limit
            if len(self._api_requests[ip_address]) > self.max_requests_per_minute:
                self.log_security_threat(
                    "api_rate_limit_exceeded",
                    ip_address=ip_address,
                    details={
                        "requests_per_minute": len(self._api_requests[ip_address]),
                        "limit": self.max_requests_per_minute,
                    },
                )
                return True

        return False

    def log_session_event(
        self,
        event_type: str,
        user_id: int,
        username: str,
        ip_address: str,
        session_data: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Log session-related security events."""

        event_data = {
            "event": "session_event",
            "event_type": event_type,
            "user_id": user_id,
            "username": username,
            "ip_address": ip_address,
            "timestamp": datetime.utcnow().isoformat(),
        }

        if session_data:
            event_data["session_data"] = session_data

        log_security_event(self.security_logger, **event_data)

    def log_configuration_change(
        self,
        user_id: int,
        username: str,
        ip_address: str,
        change_type: str,
        old_value: Optional[str],
        new_value: Optional[str],
        affected_resource: str,
    ) -> None:
        """Log system configuration changes."""

        log_security_event(
            self.audit_logger,
            event="configuration_change",
            user_id=user_id,
            username=username,
            ip_address=ip_address,
            change_type=change_type,
            old_value=old_value,
            new_value=new_value,
            affected_resource=affected_resource,
            timestamp=datetime.utcnow().isoformat(),
        )

    def get_security_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get a summary of security events from the last N hours."""

        # This would typically query the log files or a log database
        # For now, return current in-memory stats
        with self._lock:
            current_time = time.time()
            cutoff = current_time - (hours * 3600)

            summary = {
                "period_hours": hours,
                "timestamp": datetime.utcnow().isoformat(),
                "failed_login_ips": len(
                    [
                        ip
                        for ip, attempts in self._failed_logins.items()
                        if any(ts > cutoff for ts in attempts)
                    ]
                ),
                "high_traffic_ips": len(
                    [
                        ip
                        for ip, requests in self._api_requests.items()
                        if len([ts for ts in requests if ts > cutoff]) > 100
                    ]
                ),
            }

        return summary


# Global security audit manager instance
security_audit = SecurityAuditManager()
