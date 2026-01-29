import { MemoryRouter as Router } from 'react-router-dom';
import Layout from './components/Layout';
import './App.css';

export default function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}
