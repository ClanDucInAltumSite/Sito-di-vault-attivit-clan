import { render } from 'preact';
import './styles/tokens.css';
import './styles/global.css';
import './styles/components.css';
import { App } from './app/App';

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}
