import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { Provider } from 'react-redux';
import store from './store';
import HomePage from './pages/index';
import './styles/index.css';

const App = () => {
  return (
    <Provider store={store}>
      <Router>
        <Switch>
          <Route path="/" exact component={HomePage} />
          {/* Add more routes as needed */}
        </Switch>
      </Router>
    </Provider>
  );
};

export default App;