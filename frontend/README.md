# 🏺 Kinetic Curator — Frontend (Vanish UI)

The frontend of **Kinetic Curator** is a high-performance React application built with TypeScript and Vite. It implements the **Vanish Design System**, a custom-engineered UI framework focused on glassmorphism, high-speed CSS transitions, and Three.js visual effects.

## 🧬 Core Features
- **Vanish Layout**: Dynamic, hardware-accelerated collapsible sidebar and flexible main content area.
- **Three.js Particle Field**: A custom `DottedSurface` rendering engine for ambient background animations.
- **Identity-Based Isolation**: Native state management ensures that presentation previews are cleared and isolated when switching users.
- **JWT Authentication**: Secure role-based access control (RBAC) with support for User, Admin, and Master roles.

## 🛠️ Internal Architecture
- **State Orchestration**: Managed primarily in `App.tsx` for core business logic and presentation generation.
- **Design Tokens**: Centralized in `index.css` using CSS variables for colors, spacing, and glass effects.
- **Responsive Logic**: Optimized for desktop-first professional use with fluid scaling.

## 🚀 Build Instructions
To build the application for production:

```bash
# Install dependencies
npm install

# Production build
npm run build
```

The output will be generated in the `dist/` directory, ready to be served by any static host (Vercel, Netlify, etc.).

---
© 2026 iamneo | **Kinetic Curator**
