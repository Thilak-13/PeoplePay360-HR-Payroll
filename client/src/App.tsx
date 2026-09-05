import React from 'react';
import { AuthProvider } from './pages/auth/AuthContext';
import { RoleProvider } from './components/shared/RoleContext';
import { AppShell } from './components/shared';

export function App() {
  return (
    <AuthProvider>
      <RoleProvider>
        <AppShell />
      </RoleProvider>
    </AuthProvider>
  );
}

export default App;

