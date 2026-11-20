import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import Icon from "../icon";

const navClass = ({ isActive }) =>
  isActive ? "admin-nav-item active" : "admin-nav-item";

const userMenuItems = [
  { label: "Users", to: "/admin/users", icon: "user" },
  { label: "Roles", to: "/admin/roles", icon: "roles" },
  { label: "Permissions", to: "/admin/permissions", icon: "key" },
];

// Item yang terkunci: bukan link, hanya teks dengan ikon gembok
function Locked({ icon, label }) {
  return (
    <div
      className="admin-nav-item locked"
      aria-disabled="true"
      title="Terkunci sampai pengajuan prioritas selesai"
    >
      <Icon name={icon} size={16} /> {label}
      <Icon name="lock" size={14} />
    </div>
  );
}

function AdminSidebar({ open, locked, onNavigate, onLogout }) {
  const { pathname } = useLocation();
  const inUserMenu = [
    "/admin/users",
    "/admin/roles",
    "/admin/permissions",
  ].some((p) => pathname.startsWith(p));
  const [menuOpen, setMenuOpen] = useState(inUserMenu);

  return (
    <aside className={`admin-sidebar ${open ? "open" : ""}`}>
      {locked ? (
        <Locked icon="users" label="User Management" />
      ) : (
        <>
          <button
            className="admin-nav-item admin-nav-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Icon name="users" size={16} /> User Management
            <Icon name={menuOpen ? "chevron-up" : "chevron-down"} size={14} />
          </button>
          {menuOpen && (
            <div className="admin-submenu">
              {userMenuItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navClass}
                  onClick={onNavigate}
                >
                  <Icon name={item.icon} size={15} /> {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </>
      )}

      <NavLink to="/admin/pengajuan" className={navClass} onClick={onNavigate}>
        <Icon name="trophy" size={16} /> Pengajuan Turnamen
      </NavLink>

      {locked ? (
        <Locked icon="gamepad" label="Kelola Game" />
      ) : (
        <NavLink to="/admin/games" className={navClass} onClick={onNavigate}>
          <Icon name="gamepad" size={16} /> Kelola Game
        </NavLink>
      )}

      <button className="admin-nav-item sidebar-logout" onClick={onLogout}>
        <Icon name="logout" size={18} /> Keluar
      </button>
    </aside>
  );
}

export default AdminSidebar;
