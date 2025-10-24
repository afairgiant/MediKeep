import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Button } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { getNavigationSections, VIEWPORT_CONFIGS } from '../../config/navigation.config';
import { useViewport } from '../../hooks/useViewport';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';
import './DesktopNavigation.css';

const DesktopNavigation = ({ user, isAdmin, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('navigation');
  const { viewport, width } = useViewport();
  
  // Get navigation sections based on viewport (desktop or laptop)
  const navigationSections = getNavigationSections(viewport, isAdmin);
  const config = VIEWPORT_CONFIGS[viewport];
  
  const isCurrentPath = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };
  
  const handleNavigation = (path) => {
    navigate(path);
  };
  
  // Determine if we should use compact mode (for laptop)
  const isCompact = viewport === 'laptop';
  
  return (
    <div className={`desktop-navigation ${isCompact ? 'compact' : ''}`}>
      <div className="desktop-nav-content">
        {/* Main navigation dropdowns */}
        {Object.entries(navigationSections).map(([key, section]) => {
          // Skip admin section from main nav (goes in account dropdown)
          if (key === 'admin') return null;
          
          return (
            <Menu
              key={key}
              position="bottom-start"
              offset={8}
              withinPortal={true}
              transitionProps={{ transition: 'pop-top-left', duration: 150 }}
              middlewares={{
                shift: true,
                flip: true,
                inline: false,
              }}
            >
              <Menu.Target>
                <Button
                  variant="subtle"
                  className="desktop-nav-trigger"
                  rightSection={<IconChevronDown size={14} />}
                  size={isCompact ? 'sm' : 'md'}
                >
                  {t(section.titleKey, section.title || section.titleKey)}
                </Button>
              </Menu.Target>

              <Menu.Dropdown className="desktop-nav-dropdown">
                <Menu.Label>{t(section.titleKey, section.title || section.titleKey)}</Menu.Label>
                {section.items.map((item) => (
                  <Menu.Item
                    key={item.id}
                    leftSection={
                      <span className="nav-icon">{item.icon}</span>
                    }
                    onClick={() => handleNavigation(item.path)}
                    className={isCurrentPath(item.path) ? 'nav-item-active' : ''}
                  >
                    {t(item.nameKey, item.name || item.nameKey)}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          );
        })}
        
        {/* Spacer to push account to the right */}
        <div className="nav-spacer" />
        
        {/* Account dropdown */}
        <Menu
          position={width <= 1280 ? "bottom-end" : "bottom-end"}
          offset={8}
          withinPortal={true}
          transitionProps={{ transition: 'pop-top-right', duration: 150 }}
          middlewares={{
            shift: true,
            flip: true,
            inline: false,
            size: {
              apply({ availableWidth, availableHeight, elements }) {
                Object.assign(elements.floating.style, {
                  maxWidth: `${Math.min(320, availableWidth - 20)}px`,
                  maxHeight: `${Math.min(600, availableHeight - 20)}px`,
                });
              },
            },
          }}
        >
          <Menu.Target>
            <Button
              variant="subtle"
              className="desktop-nav-trigger account-trigger"
              rightSection={<IconChevronDown size={14} />}
              size={isCompact ? 'sm' : 'md'}
            >
              {t('menu.profile', 'Account')}
            </Button>
          </Menu.Target>

          <Menu.Dropdown className="desktop-nav-dropdown account-dropdown">
            <Menu.Item
              onClick={() => navigate('/settings')}
            >
              {t('menu.settings', 'Settings')}
            </Menu.Item>

            <Menu.Item closeMenuOnClick={false}>
              <div className="theme-toggle-menu-item">
                <span>{t('sidebarNav.items.language', 'Language')}</span>
                <LanguageSwitcher size="xs" />
              </div>
            </Menu.Item>

            <Menu.Item>
              <div className="theme-toggle-menu-item">
                <span>{t('sidebarNav.items.theme', 'Theme')}</span>
                <ThemeToggle />
              </div>
            </Menu.Item>

            <Menu.Item
              onClick={onLogout}
              color="red"
            >
              {t('menu.logout', 'Logout')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
};

export default DesktopNavigation;