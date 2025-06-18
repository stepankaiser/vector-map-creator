class VectorMapCreator {
    constructor() {
        this.svg = null;
        this.projection = null;
        this.path = null;
        this.worldData = null;
        this.zoom = null;
        this.currentRegion = 'world';
        
        this.init();
    }

    async init() {
        await this.loadMapData();
        this.setupSVG();
        this.setupControls();
        this.renderMap();
    }

    async loadMapData() {
        try {
            // Try multiple CDN sources for world data
            const sources = [
                'https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson',
                'https://cdn.jsdelivr.net/npm/world-atlas@1/world/110m.json'
            ];
            
            let dataLoaded = false;
            
            for (let source of sources) {
                try {
                    console.log(`Trying to load data from: ${source}`);
                    const response = await fetch(source);
                    
                    if (response.ok) {
                        const data = await response.json();
                        
                        // Handle different data formats
                        if (data.type === 'FeatureCollection') {
                            // GeoJSON format - convert to our expected format
                            this.worldData = {
                                type: "FeatureCollection",
                                features: data.features
                            };
                            this.isGeoJSON = true;
                        } else if (data.objects) {
                            // TopoJSON format
                            this.worldData = data;
                            this.isGeoJSON = false;
                        }
                        
                        dataLoaded = true;
                        console.log('Map data loaded successfully');
                        break;
                    }
                } catch (e) {
                    console.log(`Failed to load from ${source}:`, e);
                    continue;
                }
            }
            
            if (!dataLoaded) {
                throw new Error('All data sources failed');
            }
            
            // Hide loading indicator
            document.querySelector('.loading').style.display = 'none';
        } catch (error) {
            console.error('Error loading map data:', error);
            this.createFallbackData();
        }
    }

    createFallbackData() {
        // Create a simple fallback when external data is unavailable
        this.worldData = null;
        this.isGeoJSON = false;
        
        const loadingEl = document.querySelector('.loading');
        if (loadingEl) {
            loadingEl.innerHTML = '<p style="color: #e74c3c;">⚠️ Map data unavailable. Using simplified view.</p>';
        }
        
        console.log('Using fallback map data');
    }

    setupSVG() {
        const container = d3.select('#map-canvas');
        const containerNode = container.node();
        const rect = containerNode.getBoundingClientRect();
        
        this.width = rect.width;
        this.height = rect.height - 50; // Account for loading message space

        this.svg = container.append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('background', '#f8f9fa');

        // Setup zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 8])
            .on('zoom', (event) => {
                this.svg.selectAll('g').attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        this.mapGroup = this.svg.append('g');
    }

    setupProjection(projectionType = 'Natural Earth') {
        const projections = {
            'Natural Earth': d3.geoNaturalEarth1(),
            'Mercator': d3.geoMercator(),
            'Robinson': d3.geoRobinson(),
            'Orthographic': d3.geoOrthographic()
        };

        this.projection = projections[projectionType] || projections['Natural Earth'];
        this.projection.fitSize([this.width, this.height], {type: "Sphere"});
        
        this.path = d3.geoPath().projection(this.projection);
    }

    renderMap() {
        console.log('Rendering map...', 'Region:', this.currentRegion);
        
        // Get current projection from dropdown
        const projectionType = document.getElementById('projectionSelect') ? 
                              document.getElementById('projectionSelect').value : 
                              'Natural Earth';
        console.log('Using projection:', projectionType);
        this.setupProjection(projectionType);
        
        // Clear existing map
        this.mapGroup.selectAll('*').remove();

        // Add graticule if enabled
        if (document.getElementById('showGraticule').checked) {
            const graticule = d3.geoGraticule();
            this.mapGroup.append('path')
                .datum(graticule)
                .attr('class', 'graticule')
                .attr('d', this.path);
        }

        // Add sphere (ocean)
        this.mapGroup.append('path')
            .datum({type: "Sphere"})
            .attr('fill', '#e3f2fd')
            .attr('stroke', '#90caf9')
            .attr('stroke-width', 1)
            .attr('d', this.path);

        if (this.worldData) {
            let countries;
            
            // Handle different data formats
            if (this.isGeoJSON && this.worldData.features) {
                // GeoJSON format
                countries = this.worldData;
            } else if (this.worldData.objects && this.worldData.objects.countries) {
                // TopoJSON format
                countries = topojson.feature(this.worldData, this.worldData.objects.countries);
            }
            
            if (countries && countries.features) {
                // Filter countries based on selected region
                const filteredFeatures = this.filterByRegion(countries.features);
                
                this.mapGroup.selectAll('.country')
                    .data(filteredFeatures)
                    .enter()
                    .append('path')
                    .attr('class', 'country')
                    .attr('d', this.path)
                    .attr('fill', document.getElementById('fillColor').value)
                    .attr('stroke', document.getElementById('strokeColor').value)
                    .attr('stroke-width', document.getElementById('strokeWidth').value)
                    .on('mouseover', function(event, d) {
                        d3.select(this).style('opacity', 0.8);
                        
                        // Show tooltip with country name if available
                        const countryName = d.properties?.NAME || d.properties?.NAME_EN || d.properties?.name || 'Unknown';
                        if (countryName !== 'Unknown') {
                            const tooltip = d3.select('body').append('div')
                                .attr('class', 'tooltip')
                                .style('position', 'absolute')
                                .style('background', 'rgba(0,0,0,0.8)')
                                .style('color', 'white')
                                .style('padding', '8px')
                                .style('border-radius', '4px')
                                .style('font-size', '12px')
                                .style('pointer-events', 'none')
                                .style('z-index', '1000')
                                .style('opacity', 0);
                            
                            tooltip.html(countryName)
                                .style('left', (event.pageX + 10) + 'px')
                                .style('top', (event.pageY - 10) + 'px')
                                .transition()
                                .style('opacity', 1);
                        }
                    })
                    .on('mouseout', function() {
                        d3.select(this).style('opacity', 1);
                        d3.selectAll('.tooltip').remove();
                    })
                    .on('click', function(event, d) {
                        // Toggle country selection
                        const isSelected = d3.select(this).classed('selected');
                        
                        if (isSelected) {
                            // Deselect
                            d3.select(this)
                                .classed('selected', false)
                                .attr('fill', document.getElementById('fillColor').value);
                        } else {
                            // Select
                            d3.select(this)
                                .classed('selected', true)
                                .attr('fill', '#ff6b6b'); // Highlight color
                        }
                        
                        const countryName = d.properties?.NAME || d.properties?.NAME_EN || d.properties?.name || 'Unknown';
                        console.log(`${isSelected ? 'Deselected' : 'Selected'}: ${countryName}`);
                    });

                // Add country labels if enabled
                if (document.getElementById('showLabels').checked) {
                    this.mapGroup.selectAll('.country-label')
                        .data(filteredFeatures)
                        .enter()
                        .append('text')
                        .attr('class', 'country-label')
                        .attr('transform', d => {
                            const centroid = this.path.centroid(d);
                            return isNaN(centroid[0]) ? 'translate(0,0)' : `translate(${centroid})`;
                        })
                        .text(d => {
                            const name = d.properties?.NAME_EN || d.properties?.NAME || d.properties?.name || '';
                            return name.length > 12 ? name.substring(0, 12) + '...' : name;
                        })
                        .style('display', d => {
                            const bounds = this.path.bounds(d);
                            if (isNaN(bounds[0][0])) return 'none';
                            const area = (bounds[1][0] - bounds[0][0]) * (bounds[1][1] - bounds[0][1]);
                            return area > 1000 ? 'block' : 'none'; // Show labels for larger countries
                        });
                }
            } else {
                // Fallback if data structure is unexpected
                this.createSimpleWorldMap();
            }
        } else {
            // Fallback: Create a simple world outline
            this.createSimpleWorldMap();
        }
    }

    filterByRegion(features) {
        // Filter features based on selected region
        if (this.currentRegion === 'world') {
            return features; // Show all countries
        }
        
        // Debug: log the first few features to see what properties are available
        if (features.length > 0) {
            console.log('Sample country data:', features[0].properties);
            console.log('Available properties:', Object.keys(features[0].properties));
        }
        
        // Use a more flexible continent filtering based on continent names or country names
        const continentFilters = {
            'europe': (props) => {
                const continent = props.CONTINENT || props.continent || '';
                const subregion = props.SUBREGION || props.subregion || '';
                const region = props.REGION_UN || props.region || '';
                return continent.includes('Europe') || 
                       subregion.includes('Europe') || 
                       region.includes('Europe') ||
                       ['Albania', 'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Czech Republic', 'Denmark', 
                        'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland', 
                        'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Netherlands', 'Norway', 'Poland', 
                        'Portugal', 'Romania', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 
                        'United Kingdom', 'Ukraine', 'Belarus', 'Moldova', 'Serbia', 'Montenegro', 'Bosnia and Herzegovina',
                        'North Macedonia', 'Kosovo'].includes(props.NAME || props.NAME_EN || props.name || '');
            },
            'asia': (props) => {
                const continent = props.CONTINENT || props.continent || '';
                const subregion = props.SUBREGION || props.subregion || '';
                const region = props.REGION_UN || props.region || '';
                return continent.includes('Asia') || 
                       subregion.includes('Asia') || 
                       region.includes('Asia') ||
                       ['China', 'India', 'Japan', 'South Korea', 'North Korea', 'Thailand', 'Vietnam', 
                        'Indonesia', 'Malaysia', 'Singapore', 'Philippines', 'Mongolia', 'Kazakhstan',
                        'Russia', 'Turkey', 'Iran', 'Iraq', 'Saudi Arabia', 'Israel', 'Jordan', 'Syria',
                        'Lebanon', 'Afghanistan', 'Pakistan', 'Bangladesh', 'Myanmar', 'Cambodia', 'Laos'].includes(props.NAME || props.NAME_EN || props.name || '');
            },
            'africa': (props) => {
                const continent = props.CONTINENT || props.continent || '';
                const subregion = props.SUBREGION || props.subregion || '';
                const region = props.REGION_UN || props.region || '';
                return continent.includes('Africa') || 
                       subregion.includes('Africa') || 
                       region.includes('Africa') ||
                       ['Nigeria', 'Egypt', 'South Africa', 'Kenya', 'Uganda', 'Tanzania', 'Ghana', 'Algeria',
                        'Morocco', 'Tunisia', 'Libya', 'Sudan', 'Ethiopia', 'Somalia', 'Democratic Republic of the Congo',
                        'Angola', 'Mozambique', 'Madagascar', 'Cameroon', 'Niger', 'Mali', 'Burkina Faso'].includes(props.NAME || props.NAME_EN || props.name || '');
            },
            'north-america': (props) => {
                const continent = props.CONTINENT || props.continent || '';
                const subregion = props.SUBREGION || props.subregion || '';
                const region = props.REGION_UN || props.region || '';
                return continent.includes('North America') || 
                       subregion.includes('North America') || 
                       region.includes('North America') ||
                       ['United States', 'Canada', 'Mexico', 'Guatemala', 'Belize', 'El Salvador', 'Honduras',
                        'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Jamaica', 'Haiti', 'Dominican Republic'].includes(props.NAME || props.NAME_EN || props.name || '');
            },
            'south-america': (props) => {
                const continent = props.CONTINENT || props.continent || '';
                const subregion = props.SUBREGION || props.subregion || '';
                const region = props.REGION_UN || props.region || '';
                return continent.includes('South America') || 
                       subregion.includes('South America') || 
                       region.includes('South America') ||
                       ['Brazil', 'Argentina', 'Chile', 'Peru', 'Colombia', 'Venezuela', 'Ecuador', 'Bolivia',
                        'Paraguay', 'Uruguay', 'Guyana', 'Suriname', 'French Guiana'].includes(props.NAME || props.NAME_EN || props.name || '');
            },
            'oceania': (props) => {
                const continent = props.CONTINENT || props.continent || '';
                const subregion = props.SUBREGION || props.subregion || '';
                const region = props.REGION_UN || props.region || '';
                return continent.includes('Oceania') || 
                       subregion.includes('Oceania') || 
                       region.includes('Oceania') ||
                       ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Islands', 'Vanuatu',
                        'Samoa', 'Tonga', 'Kiribati', 'Palau', 'Marshall Islands', 'Micronesia'].includes(props.NAME || props.NAME_EN || props.name || '');
            }
        };
        
        if (this.currentRegion === 'continents') {
            // Show all countries but grouped by continents
            return features;
        }
        
        // Filter by specific continent
        const filterFunc = continentFilters[this.currentRegion];
        if (filterFunc) {
            const filtered = features.filter(feature => filterFunc(feature.properties));
            console.log(`Filtered ${this.currentRegion}: ${filtered.length} countries found`);
            return filtered;
        }
        
        return features; // Fallback to show all
    }

    createSimpleWorldMap() {
        // Create a more realistic simple representation when data is unavailable
        const worldWidth = this.width;
        const worldHeight = this.height;
        const centerX = worldWidth / 2;
        const centerY = worldHeight / 2;
        
        const continents = [
            { 
                name: 'North America', 
                path: `M${centerX-200},${centerY-100} L${centerX-50},${centerY-100} L${centerX-30},${centerY-50} L${centerX-100},${centerY+20} L${centerX-200},${centerY-20} Z` 
            },
            { 
                name: 'South America', 
                path: `M${centerX-100},${centerY+20} L${centerX-60},${centerY+20} L${centerX-80},${centerY+120} L${centerX-120},${centerY+110} Z` 
            },
            { 
                name: 'Europe', 
                path: `M${centerX-20},${centerY-80} L${centerX+30},${centerY-80} L${centerX+30},${centerY-30} L${centerX-20},${centerY-30} Z` 
            },
            { 
                name: 'Africa', 
                path: `M${centerX-20},${centerY-30} L${centerX+30},${centerY-30} L${centerX+20},${centerY+80} L${centerX-10},${centerY+80} Z` 
            },
            { 
                name: 'Asia', 
                path: `M${centerX+30},${centerY-80} L${centerX+180},${centerY-80} L${centerX+180},${centerY+30} L${centerX+30},${centerY+30} Z` 
            },
            { 
                name: 'Australia', 
                path: `M${centerX+120},${centerY+50} L${centerX+180},${centerY+50} L${centerX+180},${centerY+80} L${centerX+120},${centerY+80} Z` 
            }
        ];

        this.mapGroup.selectAll('.continent')
            .data(continents)
            .enter()
            .append('path')
            .attr('class', 'country continent')
            .attr('d', d => d.path)
            .attr('fill', document.getElementById('fillColor').value)
            .attr('stroke', document.getElementById('strokeColor').value)
            .attr('stroke-width', document.getElementById('strokeWidth').value)
            .on('mouseover', function(event, d) {
                d3.select(this).style('opacity', 0.8);
            })
            .on('mouseout', function() {
                d3.select(this).style('opacity', 1);
            });

        if (document.getElementById('showLabels').checked) {
            this.mapGroup.selectAll('.continent-label')
                .data(continents)
                .enter()
                .append('text')
                .attr('class', 'country-label')
                .attr('x', (d, i) => {
                    const positions = [centerX-125, centerX-80, centerX+5, centerX+5, centerX+105, centerX+150];
                    return positions[i];
                })
                .attr('y', (d, i) => {
                    const positions = [centerY-50, centerY+70, centerY-55, centerY+25, centerY-25, centerY+65];
                    return positions[i];
                })
                .text(d => d.name);
        }
    }

    setupControls() {
        console.log('Setting up controls...');
        
        // Region selection
        const regionSelect = document.getElementById('regionSelect');
        if (regionSelect) {
            regionSelect.addEventListener('change', (e) => {
                console.log('Region changed to:', e.target.value);
                this.currentRegion = e.target.value;
                this.renderMap();
            });
        }

        // Style controls
        ['fillColor', 'strokeColor'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    console.log(`${id} changed to:`, element.value);
                    this.updateMapStyle();
                });
            }
        });

        const strokeWidthElement = document.getElementById('strokeWidth');
        if (strokeWidthElement) {
            strokeWidthElement.addEventListener('input', (e) => {
                document.getElementById('strokeWidthValue').textContent = e.target.value + 'px';
                this.updateMapStyle();
            });
        }

        // Options
        ['showLabels', 'showGraticule'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    console.log(`${id} toggled:`, element.checked);
                    this.renderMap();
                });
            }
        });

        // Projection
        const projectionSelect = document.getElementById('projectionSelect');
        if (projectionSelect) {
            projectionSelect.addEventListener('change', (e) => {
                console.log('Projection changed to:', e.target.value);
                this.renderMap();
            });
        }

        // Export buttons
        const exportSVG = document.getElementById('exportSVG');
        if (exportSVG) {
            exportSVG.addEventListener('click', () => {
                this.exportSVG();
            });
        }

        const exportPNG = document.getElementById('exportPNG');
        if (exportPNG) {
            exportPNG.addEventListener('click', () => {
                this.exportPNG();
            });
        }

        // Selection buttons
        const selectAllBtn = document.getElementById('selectAll');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllVisible();
            });
        }

        const clearSelectionBtn = document.getElementById('clearSelection');
        if (clearSelectionBtn) {
            clearSelectionBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }
        
        console.log('Controls setup complete');
    }

    updateMapStyle() {
        const fillColor = document.getElementById('fillColor').value;
        const strokeColor = document.getElementById('strokeColor').value;
        const strokeWidth = document.getElementById('strokeWidth').value;

        this.svg.selectAll('.country')
            .attr('fill', function() {
                // Keep selected countries highlighted
                return d3.select(this).classed('selected') ? '#ff6b6b' : fillColor;
            })
            .attr('stroke', function() {
                return d3.select(this).classed('selected') ? '#ff4757' : strokeColor;
            })
            .attr('stroke-width', function() {
                return d3.select(this).classed('selected') ? '2' : strokeWidth;
            });
    }

    exportSVG() {
        // Get all selected countries
        const selectedCountries = this.svg.selectAll('.country.selected');
        
        if (selectedCountries.empty()) {
            alert('Please select some countries first by clicking on them!');
            return;
        }
        
        // Create a new SVG for export with only selected countries
        const exportSVG = d3.create('svg');
        
        // Calculate bounds of selected countries
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        selectedCountries.each(function(d) {
            const bounds = d3.select(this).node().getBBox();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        // Add some padding
        const padding = 20;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        exportSVG
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `${minX} ${minY} ${width} ${height}`)
            .attr('xmlns', 'http://www.w3.org/2000/svg');
        
        // Copy selected countries to the export SVG
        selectedCountries.each(function(d) {
            const originalPath = d3.select(this);
            const pathData = originalPath.attr('d');
            const fillColor = document.getElementById('fillColor').value;
            const strokeColor = document.getElementById('strokeColor').value;
            const strokeWidth = document.getElementById('strokeWidth').value;
            
            exportSVG.append('path')
                .attr('d', pathData)
                .attr('fill', fillColor)
                .attr('stroke', strokeColor)
                .attr('stroke-width', strokeWidth)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round');
        });
        
        // Convert to string and download
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(exportSVG.node());
        
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `selected-countries-${Date.now()}.svg`;
        link.click();
        
        URL.revokeObjectURL(url);
        
        console.log(`Exported ${selectedCountries.size()} selected countries to SVG`);
    }

    exportPNG() {
        // Get all selected countries
        const selectedCountries = this.svg.selectAll('.country.selected');
        
        if (selectedCountries.empty()) {
            alert('Please select some countries first by clicking on them!');
            return;
        }
        
        // Create a new SVG for export with only selected countries (same as SVG export)
        const exportSVG = d3.create('svg');
        
        // Calculate bounds of selected countries
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        selectedCountries.each(function(d) {
            const bounds = d3.select(this).node().getBBox();
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        // Add some padding
        const padding = 20;
        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;
        
        const width = maxX - minX;
        const height = maxY - minY;
        
        exportSVG
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `${minX} ${minY} ${width} ${height}`)
            .attr('xmlns', 'http://www.w3.org/2000/svg');
        
        // Copy selected countries to the export SVG
        selectedCountries.each(function(d) {
            const originalPath = d3.select(this);
            const pathData = originalPath.attr('d');
            const fillColor = document.getElementById('fillColor').value;
            const strokeColor = document.getElementById('strokeColor').value;
            const strokeWidth = document.getElementById('strokeWidth').value;
            
            exportSVG.append('path')
                .attr('d', pathData)
                .attr('fill', fillColor)
                .attr('stroke', strokeColor)
                .attr('stroke-width', strokeWidth)
                .attr('stroke-linejoin', 'round')
                .attr('stroke-linecap', 'round');
        });
        
        // Convert SVG to PNG
        const svgData = new XMLSerializer().serializeToString(exportSVG.node());
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        // High resolution canvas
        canvas.width = width * 2;
        canvas.height = height * 2;
        
        img.onload = () => {
            ctx.scale(2, 2);
            
            // Transparent background (no white fill for clean export)
            ctx.clearRect(0, 0, width, height);
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `selected-countries-${Date.now()}.png`;
                link.click();
                URL.revokeObjectURL(url);
            });
        };
        
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
        
        console.log(`Exported ${selectedCountries.size()} selected countries to PNG`);
    }

    selectAllVisible() {
        const allCountries = this.svg.selectAll('.country');
        allCountries.each(function() {
            d3.select(this).classed('selected', true);
        });
        this.updateMapStyle();
        console.log(`Selected all ${allCountries.size()} visible countries`);
    }

    clearSelection() {
        const selectedCountries = this.svg.selectAll('.country.selected');
        selectedCountries.each(function() {
            d3.select(this).classed('selected', false);
        });
        this.updateMapStyle();
        console.log('Cleared all selections');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VectorMapCreator();
}); 