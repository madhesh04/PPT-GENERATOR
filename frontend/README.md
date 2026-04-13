# 🪐 SkyNet — Frontend (Vanish UI / Skynet Theme)

The frontend of **SkyNet PPT Generator** is a high-performance React application built with TypeScript and Vite. It implements a custom-engineered UI framework focused on glassmorphism, high-contrast mechanical aesthetics, and hardware-accelerated background effects.

## 🧬 Core Features
- **Skynet Access Protocol**: Adapted login system supporting **Employee ID** authentication and external Timesheet role mapping.
- **Vanish Layout**: Dynamic, collapsible sidebar with role-aware navigation (User/Admin).
- **Mechanical Glassmorphism**: High-contrast UI with scanlines, particle fields, and mechanical animation effects.
- **Identity-Based Isolation**: Secure state management ensures that presentation previews are isolated to the authenticated employee.

## 🛡️ Authentication Architecture
- **Shared Identity**: Authentication is delegated to the external Timesheet database.
- **RBAC**: Native role-based access control supporting `USER` and `ADMIN` tiers.
- **Managed Access**: Registration is disabled on the frontend; users are directed to the Timesheet administration system for account creation.

## 🛠️ Internal Architecture
- **State Orchestration**: Managed in `useAuthStore` and `App.tsx` for core business logic and presentation generation.
- **Standardized UI**: Components in `components/ui/` provide a consistent design language across the application.
- **Vite-Powered**: Ultra-fast hot module replacement (HMR) for development.

## 🚀 Development & Build

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

---
© 2026 iamneo | **SkyNet**
