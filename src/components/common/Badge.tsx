import React from 'react';
import { StockStatus, ProductCategory, StockChangeReason } from '../../types';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'in-stock' | 'low-stock' | 'out-of-stock' | 'category' | 'reason' | 'default';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className = '',
}) => {
  let variantClass = '';

  switch (variant) {
    case 'in-stock':
      variantClass = 'badge-in-stock';
      break;
    case 'low-stock':
      variantClass = 'badge-low-stock';
      break;
    case 'out-of-stock':
      variantClass = 'badge-out-of-stock';
      break;
    case 'category':
      variantClass = 'badge-category';
      break;
    case 'reason':
      variantClass = 'badge-reason';
      break;
    default:
      variantClass = 'badge-category';
  }

  return <span className={`badge ${variantClass} ${className}`}>{children}</span>;
};

export const StockStatusBadge: React.FC<{ status: StockStatus }> = ({ status }) => {
  if (status === 'Out of Stock') {
    return (
      <Badge variant="out-of-stock">
        <span>●</span> Out of Stock
      </Badge>
    );
  }
  if (status === 'Low Stock') {
    return (
      <Badge variant="low-stock">
        <span>▲</span> Low Stock
      </Badge>
    );
  }
  return (
    <Badge variant="in-stock">
      <span>✓</span> In Stock
    </Badge>
  );
};

export const CategoryBadge: React.FC<{ category: ProductCategory }> = ({ category }) => {
  return <Badge variant="category">{category}</Badge>;
};

export const ReasonBadge: React.FC<{ reason: StockChangeReason }> = ({ reason }) => {
  let customClass = 'badge-reason';
  if (reason === 'Stock Correction') customClass = 'badge-reason-correction';
  if (reason === 'Sale') customClass = 'badge-reason-sale';
  if (reason === 'Purchase') customClass = 'badge-reason-purchase';
  if (reason === 'Sale Reversal') customClass = 'badge-reason-reversal';

  return <span className={`badge ${customClass}`}>{reason}</span>;
};
