import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Avatar,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Assignment as AssignmentIcon,
  EventNote as EventNoteIcon,
  Assessment as AssessmentIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useAuth, UserRole } from '../contexts/AuthContext';

/**
 * Navigation menu item configuration
 */
interface NavigationItem {
  label: string;
  path: string;
  icon: React.ReactElement;
  roles: UserRole[];
}

/**
 * Drawer width constant for consistent sizing
 */
const DRAWER_WIDTH = 240;

/**
 * Navigation menu items configuration based on user roles
 * Each item specifies which roles can access it
 */
const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
    roles: [UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  {
    label: 'Employees',
    path: '/employees',
    icon: <PeopleIcon />,
    roles: [UserRole.HR_ADMIN, UserRole.MANAGER],
  },
  {
    label: 'Onboarding',
    path: '/onboarding',
    icon: <AssignmentIcon />,
    roles: [UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  {
    label: 'Leave Requests',
    path: '/leave',
    icon: <EventNoteIcon />,
    roles: [UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
  {
    label: 'Appraisals',
    path: '/appraisals',
    icon: <AssessmentIcon />,
    roles: [UserRole.HR_ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE],
  },
];

/**
 * Dashboard Layout Component
 * 
 * Provides the main application layout with:
 * - Responsive navigation drawer (permanent on desktop, temporary on mobile)
 * - App bar with user menu and logout functionality
 * - Role-based navigation menu items
 * - Main content area with nested route rendering
 * 
 * @component
 * @example
 * ```tsx
 * <Routes>
 *   <Route element={<DashboardLayout />}>
 *     <Route path="/dashboard" element={<DashboardPage />} />
 *     <Route path="/employees" element={<EmployeesPage />} />
 *   </Route>
 * </Routes>
 * ```
 */
export const DashboardLayout: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  /**
   * Toggles mobile drawer open/closed state
   */
  const handleDrawerToggle = (): void => {
    setMobileDrawerOpen((prev) => !prev);
    console.log('[DashboardLayout] Mobile drawer toggled:', {
      newState: !mobileDrawerOpen,
    });
  };

  /**
   * Opens user menu dropdown
   */
  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>): void => {
    setUserMenuAnchor(event.currentTarget);
    console.log('[DashboardLayout] User menu opened');
  };

  /**
   * Closes user menu dropdown
   */
  const handleUserMenuClose = (): void => {
    setUserMenuAnchor(null);
    console.log('[DashboardLayout] User menu closed');
  };

  /**
   * Handles navigation to a specific route
   * Closes mobile drawer after navigation
   */
  const handleNavigate = (path: string): void => {
    console.log('[DashboardLayout] Navigating to:', { path, userId: user?.id });
    navigate(path);
    if (isMobile) {
      setMobileDrawerOpen(false);
    }
  };

  /**
   * Handles user logout
   * Closes user menu and navigates to login page
   */
  const handleLogout = async (): Promise<void> => {
    try {
      console.log('[DashboardLayout] Logout initiated:', { userId: user?.id });
      handleUserMenuClose();
      await logout();
      console.log('[DashboardLayout] Logout successful, redirecting to login');
      navigate('/login');
    } catch (error) {
      console.error('[DashboardLayout] Logout failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  /**
   * Handles navigation to profile page
   */
  const handleProfile = (): void => {
    console.log('[DashboardLayout] Navigating to profile:', { userId: user?.id });
    handleUserMenuClose();
    navigate('/profile');
  };

  /**
   * Handles navigation to settings page
   */
  const handleSettings = (): void => {
    console.log('[DashboardLayout] Navigating to settings:', { userId: user?.id });
    handleUserMenuClose();
    navigate('/settings');
  };

  /**
   * Filters navigation items based on user role
   */
  const visibleNavigationItems = NAVIGATION_ITEMS.filter((item) =>
    user?.role ? item.roles.includes(user.role) : false
  );

  /**
   * Gets user display name from user object
   */
  const getUserDisplayName = (): string => {
    if (!user) return 'User';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) return user.firstName;
    if (user.lastName) return user.lastName;
    return user.email.split('@')[0];
  };

  /**
   * Gets user initials for avatar
   */
  const getUserInitials = (): string => {
    if (!user) return 'U';
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user.firstName) return user.firstName[0].toUpperCase();
    if (user.lastName) return user.lastName[0].toUpperCase();
    return user.email[0].toUpperCase();
  };

  /**
   * Gets role display label
   */
  const getRoleLabel = (): string => {
    if (!user?.role) return '';
    switch (user.role) {
      case UserRole.HR_ADMIN:
        return 'HR Administrator';
      case UserRole.MANAGER:
        return 'Manager';
      case UserRole.EMPLOYEE:
        return 'Employee';
      default:
        return user.role;
    }
  };

  /**
   * Drawer content component
   * Shared between permanent and temporary drawers
   */
  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar>
        <Typography variant="h6" noWrap component="div">
          HR Management
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, pt: 2 }}>
        {visibleNavigationItems.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              onClick={() => handleNavigate(item.path)}
              sx={{
                mx: 1,
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ color: theme.palette.primary.main }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Version 1.0.0
        </Typography>
      </Box>
    </Box>
  );

  if (!user) {
    console.error('[DashboardLayout] No user found in auth context');
    return null;
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {getRoleLabel()}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {getUserDisplayName()}
            </Typography>
            <IconButton
              onClick={handleUserMenuOpen}
              size="small"
              aria-label="user menu"
              aria-controls="user-menu"
              aria-haspopup="true"
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: theme.palette.secondary.main,
                  fontSize: '0.875rem',
                }}
              >
                {getUserInitials()}
              </Avatar>
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* User Menu */}
      <Menu
        id="user-menu"
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleUserMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleProfile}>
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Profile</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSettings}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Settings</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Navigation Drawer - Mobile */}
      <Drawer
        variant="temporary"
        open={mobileDrawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better mobile performance
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Navigation Drawer - Desktop */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <Toolbar /> {/* Spacer for fixed AppBar */}
        <Outlet />
      </Box>
    </Box>
  );
};

export default DashboardLayout;