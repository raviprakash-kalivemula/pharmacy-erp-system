// src/components/common/SkeletonLoader.jsx
import React from 'react';

// Base skeleton element
const SkeletonElement = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Table skeleton
export const TableSkeleton = ({ rows = 5, columns = 6 }) => (
  <div className="bg-white rounded-lg shadow overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            {[...Array(columns)].map((_, i) => (
              <th key={i} className="px-4 py-3">
                <SkeletonElement className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b">
              {[...Array(columns)].map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <SkeletonElement className="h-4 w-full" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// Card skeleton
export const CardSkeleton = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    {[...Array(count)].map((_, i) => (
      <div key={i} className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <SkeletonElement className="h-4 w-24 mb-3" />
            <SkeletonElement className="h-8 w-32 mb-2" />
            <SkeletonElement className="h-3 w-20" />
          </div>
          <SkeletonElement className="h-12 w-12 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

// Form skeleton
export const FormSkeleton = ({ fields = 4 }) => (
  <div className="space-y-4">
    {[...Array(fields)].map((_, i) => (
      <div key={i}>
        <SkeletonElement className="h-4 w-24 mb-2" />
        <SkeletonElement className="h-10 w-full" />
      </div>
    ))}
    <div className="flex gap-2 pt-4">
      <SkeletonElement className="h-10 w-24" />
      <SkeletonElement className="h-10 w-24" />
    </div>
  </div>
);

// List skeleton
export const ListSkeleton = ({ items = 5 }) => (
  <div className="space-y-2">
    {[...Array(items)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-3 bg-white rounded border">
        <SkeletonElement className="h-10 w-10 rounded" />
        <div className="flex-1">
          <SkeletonElement className="h-4 w-3/4 mb-2" />
          <SkeletonElement className="h-3 w-1/2" />
        </div>
        <SkeletonElement className="h-8 w-16" />
      </div>
    ))}
  </div>
);

// Dashboard skeleton
export const DashboardSkeleton = () => (
  <div className="space-y-6">
    <SkeletonElement className="h-8 w-48" />
    <CardSkeleton count={4} />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="col-span-2">
        <div className="bg-white p-6 rounded-lg shadow">
          <SkeletonElement className="h-6 w-32 mb-4" />
          <SkeletonElement className="h-64 w-full" />
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow">
        <SkeletonElement className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <SkeletonElement key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Billing cart skeleton
export const BillingCartSkeleton = () => (
  <div className="space-y-2">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="p-2 bg-gray-50 rounded border">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <SkeletonElement className="h-4 w-32 mb-1" />
            <SkeletonElement className="h-3 w-24" />
          </div>
          <SkeletonElement className="h-4 w-4" />
        </div>
        <div className="flex gap-2 mb-1">
          <SkeletonElement className="h-8 w-24" />
          <SkeletonElement className="h-8 w-14" />
          <SkeletonElement className="h-8 flex-1" />
        </div>
        <SkeletonElement className="h-4 w-full" />
      </div>
    ))}
  </div>
);

// Export default component
const SkeletonLoader = ({ type = 'table', ...props }) => {
  switch (type) {
    case 'table':
      return <TableSkeleton {...props} />;
    case 'card':
      return <CardSkeleton {...props} />;
    case 'form':
      return <FormSkeleton {...props} />;
    case 'list':
      return <ListSkeleton {...props} />;
    case 'dashboard':
      return <DashboardSkeleton {...props} />;
    case 'billing-cart':
      return <BillingCartSkeleton {...props} />;
    default:
      return <TableSkeleton {...props} />;
  }
};

export default SkeletonLoader;