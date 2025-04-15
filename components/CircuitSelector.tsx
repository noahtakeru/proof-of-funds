/**
 * Zero-Knowledge Circuit Selector Component
 * 
 * This component provides a user interface for selecting different types of
 * Zero-Knowledge circuits for proof generation and verification.
 * 
 * Features:
 * - Visually differentiated circuit types (Standard, Threshold, Maximum)
 * - Informational tooltips explaining each circuit type
 * - Circuit selection with visual feedback
 * - Responsive design for various screen sizes
 * 
 * @param {Object} props - Component properties
 * @param {string} props.selectedCircuit - Currently selected circuit type
 * @param {Function} props.onSelectCircuit - Callback when a circuit is selected
 * @param {boolean} props.disabled - Whether the selector is disabled
 */

import React, { useState } from 'react';

// Circuit type definition with descriptions and icons
const circuitTypes = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'Proves that you have exactly the specified amount in your wallet.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  {
    id: 'threshold',
    name: 'Threshold',
    description: 'Proves that you have at least the specified amount in your wallet.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    )
  },
  {
    id: 'maximum',
    name: 'Maximum',
    description: 'Proves that you have at most the specified amount in your wallet.',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    )
  }
];

const CircuitSelector: React.FC<{
  selectedCircuit: string;
  onSelectCircuit: (circuitId: string) => void;
  disabled?: boolean;
}> = ({ 
  selectedCircuit, 
  onSelectCircuit, 
  disabled = false 
}) => {
  const [hoveredCircuit, setHoveredCircuit] = useState<string | null>(null);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Select Circuit Type
        <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zk-light text-zk">
          ZK
        </span>
      </label>
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {circuitTypes.map((circuit) => (
          <div
            key={circuit.id}
            className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
              selectedCircuit === circuit.id
                ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                : disabled
                ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
            }`}
            onClick={() => !disabled && onSelectCircuit(circuit.id)}
            onMouseEnter={() => setHoveredCircuit(circuit.id)}
            onMouseLeave={() => setHoveredCircuit(null)}
          >
            <div className="flex items-center">
              <div className={`mr-3 rounded-full p-1.5 ${
                selectedCircuit === circuit.id
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {circuit.icon}
              </div>
              <div>
                <h3 className={`text-sm font-medium ${
                  selectedCircuit === circuit.id
                    ? 'text-primary-900'
                    : 'text-gray-900'
                }`}>
                  {circuit.name}
                </h3>
              </div>
            </div>
            
            {/* Tooltip */}
            {hoveredCircuit === circuit.id && !disabled && (
              <div className="absolute z-10 w-72 px-3 py-2 text-sm font-normal text-gray-600 bg-white rounded-md shadow-lg border border-gray-200 -mt-1 left-0 sm:left-auto sm:transform sm:translate-y-0 sm:-translate-x-1/4">
                {circuit.description}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Circuit Description - shows under the selected circuit for mobile/no-hover devices */}
      <div className="mt-2 text-sm text-gray-600">
        {circuitTypes.find(c => c.id === selectedCircuit)?.description}
      </div>
    </div>
  );
};

export default CircuitSelector;