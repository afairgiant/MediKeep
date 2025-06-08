import React from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardCard = ({ title, description, link }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(link);
  };

  return (
    <div className="dashboard-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <button onClick={handleClick} className="card-link">
        {title.includes('View') ? title.split(' ')[1] : 'Access'}
      </button>
    </div>
  );
};

export default DashboardCard;
