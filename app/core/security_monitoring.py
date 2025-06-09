"""
Security Monitoring and Alerting Module

This module provides real-time security monitoring, alerting, and reporting
for the Medical Records Management System. It works with the security audit
system to provide comprehensive threat detection and response.
"""

import os
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict, deque
from pathlib import Path

from app.core.logging_config import get_logger
from app.core.config import settings


class SecurityMonitor:
    """
    Real-time security monitoring and alerting system.

    Features:
    - Real-time log analysis
    - Threat detection and alerting
    - Security metrics collection
    - Incident response automation
    """

    def __init__(self):
        self.logger = get_logger(__name__, "security")
        self.alert_logger = get_logger(__name__ + "_alerts", "security")

        # Security metrics
        self.metrics = {
            "failed_logins": defaultdict(int),
            "suspicious_requests": defaultdict(int),
            "blocked_ips": set(),
            "active_sessions": defaultdict(dict),
            "security_events": deque(maxlen=1000),  # Keep last 1000 events
        }

        # Alert thresholds
        self.thresholds = {
            "failed_logins_per_ip": 5,
            "failed_logins_per_hour": 10,
            "suspicious_requests_per_ip": 3,
            "max_concurrent_sessions": 5,
            "max_session_duration": 24 * 3600,  # 24 hours
        }

    def process_security_event(self, event_data: Dict[str, Any]) -> None:
        """Process a security event and check for alerts."""

        event_type = event_data.get("event")
        ip_address = event_data.get("ip_address", "unknown")
        timestamp = datetime.utcnow()

        # Add to metrics
        self.metrics["security_events"].append(
            {**event_data, "processed_at": timestamp.isoformat()}
        )

        # Process different event types
        if event_type == "authentication_attempt":
            self._process_auth_event(event_data, ip_address, timestamp)
        elif event_type and ("suspicious" in event_type or "threat" in event_type):
            self._process_threat_event(event_data, ip_address, timestamp)
        elif event_type == "session_event":
            self._process_session_event(event_data, timestamp)

    def _process_auth_event(
        self, event_data: Dict[str, Any], ip_address: str, timestamp: datetime
    ) -> None:
        """Process authentication events."""

        success = event_data.get("success", False)

        if not success:
            # Track failed login attempts
            self.metrics["failed_logins"][ip_address] += 1

            # Check thresholds
            if (
                self.metrics["failed_logins"][ip_address]
                >= self.thresholds["failed_logins_per_ip"]
            ):
                self._trigger_alert(
                    alert_type="FAILED_LOGIN_THRESHOLD",
                    ip_address=ip_address,
                    details={
                        "failed_attempts": self.metrics["failed_logins"][ip_address],
                        "threshold": self.thresholds["failed_logins_per_ip"],
                        "username": event_data.get("username"),
                    },
                )

                # Auto-block IP
                self.metrics["blocked_ips"].add(ip_address)
        else:
            # Successful login - reset failed attempts for this IP
            if ip_address in self.metrics["failed_logins"]:
                del self.metrics["failed_logins"][ip_address]

    def _process_threat_event(
        self, event_data: Dict[str, Any], ip_address: str, timestamp: datetime
    ) -> None:
        """Process threat/suspicious activity events."""

        self.metrics["suspicious_requests"][ip_address] += 1

        # Check thresholds
        if (
            self.metrics["suspicious_requests"][ip_address]
            >= self.thresholds["suspicious_requests_per_ip"]
        ):
            self._trigger_alert(
                alert_type="SUSPICIOUS_ACTIVITY_THRESHOLD",
                ip_address=ip_address,
                details={
                    "suspicious_requests": self.metrics["suspicious_requests"][
                        ip_address
                    ],
                    "threshold": self.thresholds["suspicious_requests_per_ip"],
                    "threat_type": event_data.get("threat_type"),
                },
            )

            # Auto-block IP
            self.metrics["blocked_ips"].add(ip_address)

    def _process_session_event(
        self, event_data: Dict[str, Any], timestamp: datetime
    ) -> None:
        """Process session-related events."""

        event_type = event_data.get("event_type")
        user_id = event_data.get("user_id")

        if event_type == "session_start":
            # Track active sessions
            self.metrics["active_sessions"][user_id] = {
                "start_time": timestamp,
                "ip_address": event_data.get("ip_address"),
                "user_agent": event_data.get("session_data", {}).get("user_agent"),
            }

            # Check concurrent sessions
            user_sessions = len(
                [
                    s
                    for s in self.metrics["active_sessions"].values()
                    if s.get("user_id") == user_id
                ]
            )

            if user_sessions > self.thresholds["max_concurrent_sessions"]:
                self._trigger_alert(
                    alert_type="EXCESSIVE_CONCURRENT_SESSIONS",
                    user_id=user_id,
                    details={
                        "concurrent_sessions": user_sessions,
                        "threshold": self.thresholds["max_concurrent_sessions"],
                    },
                )

        elif event_type == "session_end":
            # Remove from active sessions
            if user_id in self.metrics["active_sessions"]:
                del self.metrics["active_sessions"][user_id]

    def _trigger_alert(
        self,
        alert_type: str,
        details: Dict[str, Any],
        ip_address: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> None:
        """Trigger a security alert."""

        alert_data = {
            "alert_type": alert_type,
            "timestamp": datetime.utcnow().isoformat(),
            "severity": self._get_alert_severity(alert_type),
            "details": details,
        }

        if ip_address:
            alert_data["ip_address"] = ip_address
        if user_id:
            alert_data["user_id"] = user_id

        # Log the alert
        self.alert_logger.error(
            f"SECURITY ALERT: {alert_type}",
            extra={"category": "security", "event": "security_alert", **alert_data},
        )

        # In a production system, you might also:
        # - Send email notifications
        # - Send webhook alerts
        # - Update a dashboard
        # - Automatically block IPs

    def _get_alert_severity(self, alert_type: str) -> str:
        """Get the severity level for an alert type."""

        high_severity = [
            "FAILED_LOGIN_THRESHOLD",
            "SUSPICIOUS_ACTIVITY_THRESHOLD",
            "DATA_BREACH_ATTEMPT",
        ]

        medium_severity = ["EXCESSIVE_CONCURRENT_SESSIONS", "UNUSUAL_ACCESS_PATTERN"]

        if alert_type in high_severity:
            return "HIGH"
        elif alert_type in medium_severity:
            return "MEDIUM"
        else:
            return "LOW"

    def get_security_dashboard(self) -> Dict[str, Any]:
        """Get current security status for dashboard."""

        now = datetime.utcnow()

        # Count events in last 24 hours
        last_24h = now - timedelta(hours=24)
        recent_events = [
            event
            for event in self.metrics["security_events"]
            if datetime.fromisoformat(event.get("processed_at", "1970-01-01"))
            > last_24h
        ]

        return {
            "timestamp": now.isoformat(),
            "active_sessions": len(self.metrics["active_sessions"]),
            "blocked_ips": len(self.metrics["blocked_ips"]),
            "failed_login_attempts_24h": len(
                [
                    e
                    for e in recent_events
                    if e.get("event") == "authentication_attempt"
                    and not e.get("success", False)
                ]
            ),
            "suspicious_requests_24h": len(
                [
                    e
                    for e in recent_events
                    if "suspicious" in e.get("event", "")
                    or "threat" in e.get("event", "")
                ]
            ),
            "total_security_events_24h": len(recent_events),
            "top_threat_ips": self._get_top_threat_ips(),
            "security_status": self._get_overall_security_status(),
        }

    def _get_top_threat_ips(self) -> List[Dict[str, Any]]:
        """Get top threatening IP addresses."""

        threat_scores = defaultdict(int)

        # Calculate threat scores
        for ip, failed_logins in self.metrics["failed_logins"].items():
            threat_scores[ip] += failed_logins * 2

        for ip, suspicious_requests in self.metrics["suspicious_requests"].items():
            threat_scores[ip] += suspicious_requests * 3

        # Sort by threat score
        top_threats = sorted(threat_scores.items(), key=lambda x: x[1], reverse=True)[
            :10
        ]

        return [
            {
                "ip_address": ip,
                "threat_score": score,
                "failed_logins": self.metrics["failed_logins"].get(ip, 0),
                "suspicious_requests": self.metrics["suspicious_requests"].get(ip, 0),
                "is_blocked": ip in self.metrics["blocked_ips"],
            }
            for ip, score in top_threats
        ]

    def _get_overall_security_status(self) -> str:
        """Get overall security status."""

        if len(self.metrics["blocked_ips"]) > 10:
            return "HIGH_THREAT"
        elif len(self.metrics["blocked_ips"]) > 5:
            return "MEDIUM_THREAT"
        elif sum(self.metrics["failed_logins"].values()) > 20:
            return "ELEVATED"
        else:
            return "NORMAL"

    def is_ip_blocked(self, ip_address: str) -> bool:
        """Check if an IP address is blocked."""
        return ip_address in self.metrics["blocked_ips"]

    def block_ip(self, ip_address: str, reason: str) -> None:
        """Manually block an IP address."""

        self.metrics["blocked_ips"].add(ip_address)

        self.logger.warning(
            f"IP address blocked: {ip_address}",
            extra={
                "category": "security",
                "event": "ip_blocked",
                "ip_address": ip_address,
                "reason": reason,
                "manual_block": True,
            },
        )

    def unblock_ip(self, ip_address: str, reason: str) -> None:
        """Manually unblock an IP address."""

        if ip_address in self.metrics["blocked_ips"]:
            self.metrics["blocked_ips"].remove(ip_address)

        # Reset counters
        if ip_address in self.metrics["failed_logins"]:
            del self.metrics["failed_logins"][ip_address]
        if ip_address in self.metrics["suspicious_requests"]:
            del self.metrics["suspicious_requests"][ip_address]

        self.logger.info(
            f"IP address unblocked: {ip_address}",
            extra={
                "category": "security",
                "event": "ip_unblocked",
                "ip_address": ip_address,
                "reason": reason,
                "manual_unblock": True,
            },
        )

    def cleanup_old_data(self) -> None:
        """Clean up old security data to prevent memory buildup."""

        # This would be called periodically (e.g., daily)
        cutoff = datetime.utcnow() - timedelta(days=7)

        # Clean up active sessions older than max duration
        expired_sessions = []
        for user_id, session_data in self.metrics["active_sessions"].items():
            if session_data["start_time"] < cutoff:
                expired_sessions.append(user_id)

        for user_id in expired_sessions:
            del self.metrics["active_sessions"][user_id]

        # Reset counters weekly (configurable)
        self.metrics["failed_logins"].clear()
        self.metrics["suspicious_requests"].clear()


# Global security monitor instance
security_monitor = SecurityMonitor()
