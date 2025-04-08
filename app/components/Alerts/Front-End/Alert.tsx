'use client';

import React, { useState } from 'react';
// import 'rc-notification/assets/index.css';

export interface AlertProps {
  type: string;
  message: string;
  title?: string;
  dismissible: boolean;
}

const Alert: React.FC<AlertProps> = ({ type, message, title, dismissible }) => {
  const [visible, setVisible] = useState(true);

  const handleClose = () => {
    if (dismissible) {
      setVisible(false);
    }
  };

  return (
    visible && (
      <div className={`alert alert-${type}`}>
        {title && <h3>{title}</h3>}
        <p>{message}</p>
        {dismissible && <button onClick={handleClose}>Dismiss</button>}
      </div>
    )
  );
};

export default Alert;