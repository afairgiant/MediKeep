import React from 'react';
import { useNavigate } from 'react-router-dom';

const DashboardCard = ({ title, description, link, size = 'normal' }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(link);
  };

  const cardClass = size === 'small' ? 'dashboard-card dashboard-card-small' : 'dashboard-card';

  return (
    <div className={cardClass}>
      <h3>{title}</h3>
      <p>{description}</p>
      <button onClick={handleClick} className="card-link">
        {title.includes('View') ? title.split(' ')[1] : 'Access'}
      </button>
    </div>
  );
};

export default DashboardCard;
