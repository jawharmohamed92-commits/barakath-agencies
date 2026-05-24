import React from 'react';
import { useNavigate } from 'react-router-dom';
import PurchaseEntry from '../components/PurchaseEntry';

export default function AddPurchase() {
  const navigate = useNavigate();

  return (
    <PurchaseEntry 
      isOpen={true}
      onClose={() => navigate('/')} // Redirect back to Dashboard as requested
      onSuccess={() => navigate('/inventory')} // After success, show the management list
    />
  );
}
