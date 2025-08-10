import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Button } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { getNavigationSections, VIEWPORT_CONFIGS } from '../../config/navigation.config';
import ThemeToggle from '../ui/ThemeToggle';
import './TabletNavigation.css';

const TabletNavigation = ({ user, isAdmin, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get navigation sections for tablet
  const navigationSections = getNavigationSections('tablet', isAdmin);
  const config = VIEWPORT_CONFIGS.tablet;
  
  const isCurrentPath = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/';
    }
    return location.pathname === path;
  };
  
  const handleNavigation = (path) => {
    navigate(path);
  };
  
  // Combine providers into tools for tablet view
  const processedSections = Object.entries(navigationSections).reduce((acc, [key, section]) => {
    // Skip providers section on tablet (items merged into tools)
    if (config.hideSections?.includes(key)) {
      // Merge providers items into tools
      if (key === 'providers' && acc.tools) {
        acc.tools.items = [...acc.tools.items, ...section.items];
      }
      return acc;
    }
    acc[key] = section;
    return acc;
  }, {});
  
  return (
    <div className="tablet-navigation">
      <div className="tablet-nav-content">
        {/* Main navigation dropdowns */}
        {Object.entries(processedSections).map(([key, section]) => {
          // Skip admin section from main nav (goes in account dropdown)
          if (key === 'admin') return null;
          
          return (
            <Menu
              key={key}
              position="bottom-start"
              offset={8}
              withinPortal={true}
              transitionProps={{ transition: 'pop-top-left', duration: 150 }}
            >
              <Menu.Target>
                <Button
                  variant="subtle"
                  className="tablet-nav-trigger"
                  rightSection={<IconChevronDown size={12} />}
                  size="xs"
                >
                  {section.title}
                </Button>
              </Menu.Target>
              
              <Menu.Dropdown className="tablet-nav-dropdown">
                <Menu.Label>{section.title}</Menu.Label>
                {section.items.map((item) => (
                  <Menu.Item
                    key={item.id}
                    leftSection={
                      <span className="nav-icon">{item.icon}</span>
                    }
                    onClick={() => handleNavigation(item.path)}
                    className={isCurrentPath(item.path) ? 'nav-item-active' : ''}
                  >
                    <span className="nav-text-compact">{item.name}</span>
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
          );
        })}
        
        {/* Account dropdown */}
        <Menu
          position="bottom-end"
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
                  maxWidth: `${Math.min(280, availableWidth - 20)}px`,
                  maxHeight: `${Math.min(400, availableHeight - 20)}px`,
                });
              },
            },
          }}
        >
          <Menu.Target>
            <Button
              variant="subtle"
              className="tablet-nav-trigger account-trigger"
              rightSection={<IconChevronDown size={12} />}
              size="xs"
            >
              Account
            </Button>
          </Menu.Target>
          
          <Menu.Dropdown className="tablet-nav-dropdown account-dropdown">
            <Menu.Item
              onClick={() => navigate('/settings')}
            >
              Settings
            </Menu.Item>
            
            <Menu.Item>
              <div className="theme-toggle-menu-item">
                <span>Theme</span>
                <ThemeToggle />
              </div>
            </Menu.Item>
            
            <Menu.Item
              onClick={onLogout}
              color="red"
            >
              Logout
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
};

export default TabletNavigation;