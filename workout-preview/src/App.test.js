import { render } from '@testing-library/react';
import App from './App';
import { NotificationProvider } from './context/NotificationContext';

test('renders App component without crashing', () => {
  const { container } = render(
    <NotificationProvider>
      <App />
    </NotificationProvider>
  );
  expect(container).toBeInTheDocument();
});
