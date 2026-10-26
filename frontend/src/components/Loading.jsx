import React from 'react';

const Loading = ({ message = 'Loading MedWise Clinical Portal...' }) => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p style={{ color: 'var(--slate-600)', fontSize: '0.95rem', fontWeight: 500 }}>
        {message}
      </p>
    </div>
  );
};

export default Loading;
