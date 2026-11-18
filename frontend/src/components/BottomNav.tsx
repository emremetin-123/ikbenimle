import { NavLink } from '../router';
import { Home, UserCircle, Search } from 'lucide-react';

export const BottomNav = () => {
    return (
        <nav className="bottom-nav" aria-label="Mobil ana menü">
            <NavLink 
                to="/employee/anasayfa" 
                className={({ isActive }) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}
            >
                <Home size={22} aria-hidden="true" />
                <span>Ana Sayfa</span>
            </NavLink>

            <NavLink to="/employee/kisisel-bilgiler" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
                <UserCircle size={22} aria-hidden="true" />
                <span>Profilim</span>
            </NavLink>

            <NavLink 
                to="/employee/rehber" 
                className={({ isActive }) => isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}
            >
                <Search size={22} aria-hidden="true" />
                <span>Rehber</span>
            </NavLink>
        </nav>
    );
};
