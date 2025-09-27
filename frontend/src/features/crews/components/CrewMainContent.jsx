import React from 'react';

import CrewDetails from './crewManager/CrewDetails';
import ExecutionMonitor from './crewManager/ExecutionMonitor';

const CrewMainContent = (props) => {
  const { view } = props;

  if (view === 'monitor' || view === 'system' || view === 'activity') {
    return <ExecutionMonitor {...props} />;
  }

  return <CrewDetails {...props} />;
};

export default CrewMainContent;
