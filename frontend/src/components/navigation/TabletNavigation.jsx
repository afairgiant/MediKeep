import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Button } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { getNavigationSections } from '../../config/navigation.config';
import { useViewport } from '../../hooks/useViewport';
import ThemeToggle from '../ui/ThemeToggle';
import LanguageSwitcher from '../shared/LanguageSwitcher';

const TabletNavigation = ({ user, isAdmin, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('navigation');
  const { viewport } = useViewport();
  
  const navigationSections = getNavigationSections(viewport, isAdmin);
  
  const isCurrentPath = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };
  
  const handleNavigation = (path) => {
    navigate(path);
  };
  
  return (
    <div className="tablet-navigation">
      <div className="tablet-nav-content">
        {Object.entries(navigationSections).map(([key, section]) => {
          if (key === 'admin') return null;
          
          return (
            <Menu key={key} position="bottom-start" offset={8}>
              <Menu.Target>
                <Button variant="subtle" size="sm" rightSection={<IconChevronDown size={14} />}>
                  {section.titleKey ? t(section.titleKey, section.title) : section.title}
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>{section.titleKey ? t(section.titleKey, section.title) : section.title}</Menu.Label>
                {section.items.map((item) => (
                  <Menu.Item
                    key={item.id}
                    leftSection={<span>{item.icon}</span>}
                    onClick={() => handleNavigation(item.path)}
                    className={isCurrentPath(item.path) ? 'nav-item-active' : ''}
                  >
                    {item.nameKey ? t(item.nameKey, item.name) : item.name}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          );
        })}
        
        <div className="nav-spacer" />
        
        <Menu position="bottom-end" offset={8}>
          <Menu.Target>
            <Button variant="subtle" size="sm" rightSection={<IconChevronDown size={14} />}>
              {t('menu.profile', 'Account')}
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Item onClick={() => navigate('/settings')}>
              {t('menu.settings', 'Settings')}
            </Menu.Item>
            <Menu.Item closeMenuOnClick={false}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <span>{t('sidebarNav.items.language', 'Language')}</span>
                <LanguageSwitcher size="xs" />
              </div>
            </Menu.Item>
            <Menu.Item>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{t('sidebarNav.items.theme', 'Theme')}</span>
                <ThemeToggle />
              </div>
            </Menu.Item>
            <Menu.Item onClick={onLogout} color="red">
              {t('menu.logout', 'Logout')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
};

export default TabletNavigation;