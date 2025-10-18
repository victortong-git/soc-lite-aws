import React, { useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { MapPin, List, Map as MapIcon, Globe } from 'lucide-react';

interface AttackSource {
  source_ip: string;
  country?: string | null;
  count: number;
  blocked_count: number;
  allowed_count: number;
}

interface AttackSourceMapProps {
  sources: AttackSource[];
}

// GeoJSON URL for world map (using Natural Earth data)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Country coordinates for map visualization (major countries)
const COUNTRY_COORDS: { [key: string]: [number, number] } = {
  'US': [-95.7129, 37.0902],
  'United States': [-95.7129, 37.0902],
  'CN': [104.1954, 35.8617],
  'China': [104.1954, 35.8617],
  'RU': [105.3188, 61.5240],
  'Russia': [105.3188, 61.5240],
  'IN': [78.9629, 20.5937],
  'India': [78.9629, 20.5937],
  'BR': [-51.9253, -14.2350],
  'Brazil': [-51.9253, -14.2350],
  'GB': [-3.4360, 55.3781],
  'United Kingdom': [-3.4360, 55.3781],
  'DE': [10.4515, 51.1657],
  'Germany': [10.4515, 51.1657],
  'FR': [2.2137, 46.2276],
  'France': [2.2137, 46.2276],
  'JP': [138.2529, 36.2048],
  'Japan': [138.2529, 36.2048],
  'CA': [-106.3468, 56.1304],
  'Canada': [-106.3468, 56.1304],
  'AU': [133.7751, -25.2744],
  'Australia': [133.7751, -25.2744],
  'KR': [127.7669, 35.9078],
  'South Korea': [127.7669, 35.9078],
  'NL': [5.2913, 52.1326],
  'Netherlands': [5.2913, 52.1326],
  'IR': [53.6880, 32.4279],
  'Iran': [53.6880, 32.4279],
  'SG': [103.8198, 1.3521],
  'Singapore': [103.8198, 1.3521],
  'Unknown': [0, 0],
};

export const AttackSourceMap: React.FC<AttackSourceMapProps> = ({ sources }) => {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map');
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);

  // Filter sources with blocked attacks and calculate max for scaling
  const attackSources = sources.filter(s => s.blocked_count > 0);
  const maxBlockedCount = Math.max(...attackSources.map(s => s.blocked_count), 1);

  // Get top 5 countries by blocked count
  const top5Countries = attackSources
    .sort((a, b) => b.blocked_count - a.blocked_count)
    .slice(0, 5);

  // Get country coordinates
  const getCountryCoords = (country?: string | null): [number, number] => {
    if (!country) return COUNTRY_COORDS['Unknown'];
    return COUNTRY_COORDS[country] || COUNTRY_COORDS['Unknown'];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-theme-text flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Top Attack Sources
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${
                viewMode === 'list'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                  : 'text-theme-text-secondary hover:bg-theme-bg-secondary'
              }`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-2 rounded ${
                viewMode === 'map'
                  ? 'bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                  : 'text-theme-text-secondary hover:bg-theme-bg-secondary'
              }`}
              title="Map View"
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {viewMode === 'list' ? (
          <div className="space-y-3">
            {attackSources.length === 0 ? (
              <p className="text-center text-theme-text-secondary py-8">No blocked attacks found</p>
            ) : (
              attackSources
                .sort((a, b) => b.blocked_count - a.blocked_count)
                .map((source, index) => (
                  <div
                    key={source.source_ip}
                    className="flex items-center justify-between p-3 bg-theme-bg-secondary rounded-lg hover:bg-theme-bg-tertiary transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-theme-text-secondary" />
                          <span className="font-medium text-theme-text">{source.source_ip}</span>
                        </div>
                        <p className="text-xs text-theme-text-secondary mt-1">{source.country || 'Unknown'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                        {source.blocked_count.toLocaleString()}
                      </p>
                      <p className="text-xs text-theme-text-secondary">blocked attacks</p>
                    </div>
                  </div>
                ))
            )}
          </div>
        ) : (
          <div className="relative">
            {attackSources.length === 0 ? (
              <div className="text-center py-16 text-theme-text-secondary">
                No blocked attacks to display on map
              </div>
            ) : (
              <div className="flex gap-4">
                {/* Map Section */}
                <div className="flex-1">
                  <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{
                      scale: 140,
                      center: [0, 20]
                    }}
                    className="w-full h-auto"
                    style={{ maxHeight: '400px' }}
                  >
                    <Geographies geography={GEO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill="#D6D6DA"
                            stroke="#FFFFFF"
                            strokeWidth={0.5}
                            style={{
                              default: { fill: '#E5E7EB', outline: 'none' },
                              hover: { fill: '#D1D5DB', outline: 'none' },
                              pressed: { fill: '#9CA3AF', outline: 'none' },
                            }}
                          />
                        ))
                      }
                    </Geographies>
                    
                    {/* Attack source markers */}
                    {attackSources.map((source) => {
                      const coordinates = getCountryCoords(source.country);
                      const radius = 4 + (source.blocked_count / maxBlockedCount) * 12;
                      const isHovered = hoveredSource === source.source_ip;
                      
                      return (
                        <Marker key={source.source_ip} coordinates={coordinates}>
                          <g
                            onMouseEnter={() => setHoveredSource(source.source_ip)}
                            onMouseLeave={() => setHoveredSource(null)}
                            style={{ cursor: 'pointer' }}
                          >
                            {/* Pulse animation circle */}
                            <circle
                              r={radius + 4}
                              fill="#ef4444"
                              opacity="0.3"
                              className="animate-ping"
                              style={{ animationDuration: '2s' }}
                            />
                            {/* Main marker */}
                            <circle
                              r={isHovered ? radius + 2 : radius}
                              fill="#ef4444"
                              stroke="#991b1b"
                              strokeWidth={isHovered ? 2 : 1.5}
                              opacity={isHovered ? 1 : 0.8}
                              style={{ transition: 'all 0.2s' }}
                            />
                            {/* Highlight */}
                            <circle
                              cx={-radius * 0.3}
                              cy={-radius * 0.3}
                              r={radius * 0.3}
                              fill="white"
                              opacity="0.5"
                            />
                            {/* Count label */}
                            <text
                              textAnchor="middle"
                              y={radius + 12}
                              style={{
                                fontFamily: 'system-ui',
                                fontSize: isHovered ? '11px' : '10px',
                                fontWeight: 'bold',
                                fill: '#dc2626',
                                transition: 'font-size 0.2s',
                              }}
                            >
                              {source.blocked_count}
                            </text>
                            
                            {/* Tooltip on hover */}
                            {isHovered && (
                              <g>
                                <rect
                                  x={-50}
                                  y={-radius - 35}
                                  width="100"
                                  height="30"
                                  rx="4"
                                  fill="white"
                                  stroke="#991b1b"
                                  strokeWidth="2"
                                  opacity="0.95"
                                />
                                <text
                                  textAnchor="middle"
                                  y={-radius - 25}
                                  style={{
                                    fontFamily: 'system-ui',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    fill: '#1f2937',
                                  }}
                                >
                                  {source.country || 'Unknown'}
                                </text>
                                <text
                                  textAnchor="middle"
                                  y={-radius - 12}
                                  style={{
                                    fontFamily: 'system-ui',
                                    fontSize: '10px',
                                    fill: '#6b7280',
                                  }}
                                >
                                  {source.source_ip}
                                </text>
                              </g>
                            )}
                          </g>
                        </Marker>
                      );
                    })}
                  </ComposableMap>
                  
                  {/* Bottom Legend */}
                  <div className="mt-3 flex items-center justify-center gap-6 text-xs text-theme-text-secondary">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500 opacity-60"></div>
                      <span>Low Volume</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-red-500 opacity-80"></div>
                      <span>High Volume</span>
                    </div>
                    <div className="text-theme-text-muted">
                      Hover for details
                    </div>
                  </div>
                </div>
                
                {/* Side Legend - Top 5 Countries Table */}
                <div className="w-64 flex-shrink-0">
                  <div className="border border-theme-border rounded-lg p-3 bg-theme-bg-secondary">
                    <h4 className="text-sm font-semibold text-theme-text mb-3 flex items-center gap-2">
                      <span className="text-red-600 dark:text-red-400">🎯</span>
                      Top 5 Sources
                    </h4>
                    <div className="space-y-2">
                      {top5Countries.map((source, index) => (
                        <div
                          key={source.source_ip}
                          className={`p-2 rounded transition-all ${
                            hoveredSource === source.source_ip
                              ? 'bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700'
                              : 'bg-theme-bg-primary hover:bg-theme-bg-tertiary border border-transparent'
                          }`}
                          onMouseEnter={() => setHoveredSource(source.source_ip)}
                          onMouseLeave={() => setHoveredSource(null)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 text-xs font-bold flex-shrink-0">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-theme-text truncate">
                                  {source.country || 'Unknown'}
                                </p>
                                <p className="text-xs text-theme-text-secondary font-mono truncate">
                                  {source.source_ip}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-red-600 dark:text-red-400">
                                {source.blocked_count}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t border-theme-border text-xs text-theme-text-muted text-center">
                      Hover to highlight on map
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
};
