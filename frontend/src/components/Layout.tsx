import { Outlet } from 'react-router-dom';
import './Layout.css';

const Layout = () => {
  // Return just Outlet for all users - no sidebar
  return <Outlet />;
};

export default Layout;
