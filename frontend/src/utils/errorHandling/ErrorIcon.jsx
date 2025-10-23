import React from 'react';
import {
    IconUserX,
    IconAlertTriangle,
    IconLock,
    IconShieldX,
    IconInfoCircle,
    IconClock,
    IconMailX,
    IconHelpCircle,
    IconAlertCircle,
    IconUsers,
    IconWifiOff,
    IconExclamationCircle,
    IconBan,
    IconKey,
    IconDatabase,
    IconServerOff,
    IconCloudOff
} from '@tabler/icons-react';

/**
 * Centralized error icon mapping
 * Maps semantic icon names to actual Tabler icon components
 */
const ICON_MAP = {
    // User/Authentication errors
    'user-x': IconUserX,
    'user-not-found': IconUserX,
    'invalid-user': IconUserX,
    
    // Permission/Access errors
    'lock': IconLock,
    'shield-x': IconShieldX,
    'access-denied': IconLock,
    'permission-denied': IconShieldX,
    'unauthorized': IconKey,
    
    // Network/Connection errors
    'wifi-off': IconWifiOff,
    'server-off': IconServerOff,
    'cloud-off': IconCloudOff,
    'network-error': IconWifiOff,
    
    // Time/Expiration errors
    'clock': IconClock,
    'expired': IconClock,
    'timeout': IconClock,
    
    // Data/Validation errors
    'alert-circle': IconAlertCircle,
    'exclamation-circle': IconExclamationCircle,
    'validation-error': IconAlertTriangle,
    'data-error': IconDatabase,
    
    // General warnings
    'alert-triangle': IconAlertTriangle,
    'warning': IconAlertTriangle,
    
    // Information/Help
    'info-circle': IconInfoCircle,
    'help-circle': IconHelpCircle,
    'info': IconInfoCircle,
    
    // Communication errors
    'mail-x': IconMailX,
    'mail-error': IconMailX,
    
    // Sharing/Collaboration errors
    'users': IconUsers,
    'sharing-error': IconUsers,
    
    // Blocking/Restriction errors
    'ban': IconBan,
    'blocked': IconBan,
    
    // Default fallback
    'default': IconAlertCircle
};

/**
 * ErrorIcon component - renders appropriate icon for error types
 * 
 * @param {Object} props
 * @param {string} props.icon - Icon name or semantic identifier
 * @param {string|number} props.size - Icon size (default: "1rem")
 * @param {string} props.color - Icon color (optional)
 * @param {Object} props.style - Additional styles (optional)
 * @returns {JSX.Element} Icon component
 */
export const ErrorIcon = ({ 
    icon = 'default', 
    size = '1rem', 
    color,
    style = {},
    ...props 
}) => {
    // Get the icon component, fallback to default if not found
    const IconComponent = ICON_MAP[icon] || ICON_MAP.default;
    
    return (
        <IconComponent 
            size={size} 
            color={color}
            style={style}
            {...props}
        />
    );
};

/**
 * Get just the icon component class (for cases where you need the component itself)
 * 
 * @param {string} iconName - Icon name
 * @returns {React.Component} Icon component class
 */
export const getIconComponent = (iconName) => {
    return ICON_MAP[iconName] || ICON_MAP.default;
};

/**
 * Get available icon names (useful for development/debugging)
 * 
 * @returns {string[]} Array of available icon names
 */
export const getAvailableIcons = () => {
    return Object.keys(ICON_MAP);
};