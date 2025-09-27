const React = require('react');

const createMockComponent = (displayName, withChildren = true) => {
  const MockComponent = ({ children }) =>
    React.createElement(
      'div',
      {
        'data-testid': displayName
      },
      withChildren ? children : null
    );

  MockComponent.displayName = displayName;
  return MockComponent;
};

module.exports = {
  __esModule: true,
  ResponsiveContainer: createMockComponent('ResponsiveContainer'),
  LineChart: createMockComponent('LineChart'),
  Line: createMockComponent('Line', false),
  CartesianGrid: createMockComponent('CartesianGrid', false),
  XAxis: createMockComponent('XAxis', false),
  YAxis: createMockComponent('YAxis', false),
  Tooltip: createMockComponent('Tooltip', false),
  Legend: createMockComponent('Legend', false)
};
