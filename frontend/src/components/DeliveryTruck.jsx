import React from 'react';

const DeliveryTruck = ({ className }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 640 480"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Truck Body */}
      <rect x="20" y="180" width="320" height="180" rx="10" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="4"/>
      
      {/* Cargo Area */}
      <rect x="30" y="190" width="300" height="120" rx="5" fill="#2a2a2a"/>
      
      {/* Cargo Lines */}
      <line x1="80" y1="190" x2="80" y2="310" stroke="#ff6b00" strokeWidth="2" strokeOpacity="0.5"/>
      <line x1="130" y1="190" x2="130" y2="310" stroke="#ff6b00" strokeWidth="2" strokeOpacity="0.5"/>
      <line x1="180" y1="190" x2="180" y2="310" stroke="#ff6b00" strokeWidth="2" strokeOpacity="0.5"/>
      <line x1="230" y1="190" x2="230" y2="310" stroke="#ff6b00" strokeWidth="2" strokeOpacity="0.5"/>
      <line x1="280" y1="190" x2="280" y2="310" stroke="#ff6b00" strokeWidth="2" strokeOpacity="0.5"/>
      
      {/* Cabin */}
      <path
        d="M340 220 L340 360 L480 360 L480 280 L420 220 Z"
        fill="#1a1a1a"
        stroke="#ff6b00"
        strokeWidth="4"
      />
      
      {/* Window */}
      <path
        d="M350 240 L350 300 L410 300 L410 260 L380 240 Z"
        fill="#3a3a3a"
        stroke="#ff6b00"
        strokeWidth="2"
      />
      
      {/* Window Reflection */}
      <path
        d="M355 245 L355 270 L385 270 L385 255 L370 245 Z"
        fill="#ff6b00"
        fillOpacity="0.1"
      />
      
      {/* Door */}
      <rect x="420" y="250" width="50" height="110" rx="3" fill="#2a2a2a" stroke="#ff6b00" strokeWidth="2"/>
      
      {/* Door Handle */}
      <rect x="430" y="300" width="15" height="6" rx="2" fill="#ff6b00"/>
      
      {/* Headlight */}
      <ellipse cx="475" cy="320" rx="12" ry="15" fill="#ffcc00"/>
      <ellipse cx="475" cy="320" rx="8" ry="10" fill="#fff5cc"/>
      
      {/* Front Bumper */}
      <rect x="470" y="345" width="20" height="15" rx="3" fill="#ff6b00"/>
      
      {/* Side Mirror */}
      <rect x="480" y="250" width="25" height="15" rx="3" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="2"/>
      
      {/* Back Wheel */}
      <circle cx="120" cy="380" r="50" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="4"/>
      <circle cx="120" cy="380" r="35" fill="#2a2a2a"/>
      <circle cx="120" cy="380" r="20" fill="#ff6b00"/>
      <circle cx="120" cy="380" r="10" fill="#1a1a1a"/>
      
      {/* Front Wheel */}
      <circle cx="400" cy="380" r="50" fill="#1a1a1a" stroke="#ff6b00" strokeWidth="4"/>
      <circle cx="400" cy="380" r="35" fill="#2a2a2a"/>
      <circle cx="400" cy="380" r="20" fill="#ff6b00"/>
      <circle cx="400" cy="380" r="10" fill="#1a1a1a"/>
      
      {/* Wheel Spokes - Back */}
      <line x1="120" y1="350" x2="120" y2="410" stroke="#ff6b00" strokeWidth="3"/>
      <line x1="90" y1="380" x2="150" y2="380" stroke="#ff6b00" strokeWidth="3"/>
      <line x1="98" y1="358" x2="142" y2="402" stroke="#ff6b00" strokeWidth="3"/>
      <line x1="98" y1="402" x2="142" y2="358" stroke="#ff6b00" strokeWidth="3"/>
      
      {/* Wheel Spokes - Front */}
      <line x1="400" y1="350" x2="400" y2="410" stroke="#ff6b00" strokeWidth="3"/>
      <line x1="370" y1="380" x2="430" y2="380" stroke="#ff6b00" strokeWidth="3"/>
      <line x1="378" y1="358" x2="422" y2="402" stroke="#ff6b00" strokeWidth="3"/>
      <line x1="378" y1="402" x2="422" y2="358" stroke="#ff6b00" strokeWidth="3"/>
      
      {/* Company Logo on side */}
      <rect x="140" y="220" width="80" height="50" rx="5" fill="#ff6b00"/>
      <text x="180" y="252" textAnchor="middle" fill="#1a1a1a" fontSize="18" fontWeight="bold">KARGO</text>
      
      {/* Exhaust */}
      <rect x="5" y="340" width="25" height="12" rx="3" fill="#4a4a4a"/>
      
      {/* Smoke particles */}
      <circle cx="-10" cy="340" r="8" fill="#666" fillOpacity="0.6">
        <animate attributeName="cx" values="-10;-50" dur="1s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0" dur="1s" repeatCount="indefinite"/>
        <animate attributeName="r" values="8;20" dur="1s" repeatCount="indefinite"/>
      </circle>
      <circle cx="-20" cy="335" r="6" fill="#666" fillOpacity="0.4">
        <animate attributeName="cx" values="-20;-70" dur="1.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.4;0" dur="1.2s" repeatCount="indefinite"/>
        <animate attributeName="r" values="6;18" dur="1.2s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
};

export default DeliveryTruck;
