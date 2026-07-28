import { render, screen } from '@testing-library/react';
import App from '../../src/App';

describe('App Component', () => {
  test('renders the main application layout', () => {
    render(<App />);
    const linkElement = screen.getByText(/What's happening?/i);
    expect(linkElement).toBeInTheDocument();
  });

  test('displays the correct title', () => {
    render(<App />);
    const titleElement = screen.getByRole('heading', { name: /TitanOS/i });
    expect(titleElement).toBeInTheDocument();
  });

  test('navigates to the correct page', () => {
    render(<App />);
    const navElement = screen.getByText(/Home/i);
    expect(navElement).toBeInTheDocument();
  });
});