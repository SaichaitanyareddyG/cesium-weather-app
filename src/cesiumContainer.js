import React, { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import geoJsonData from './india_state_geo.json'; // Adjust the path as necessary

let viewer;

const CesiumContainer = () => {
  const containerRef = useRef(null);
  const [highlightedStateName, setHighlightedStateName] = useState(''); // State for highlighted state name
  const statesData = {
    "Andhra Pradesh": [15.9129, 79.7400],
    "Arunachal Pradesh": [28.2180, 94.7278],
    "Assam": [26.2006, 92.9376],
    "Bihar": [25.0961, 85.3131],
    "Chhattisgarh": [21.2787, 81.8661],
    "Goa": [15.2993, 74.1240],
    "Gujarat": [22.2587, 71.1924],
    "Haryana": [29.0588, 76.0856],
    "Himachal Pradesh": [31.1048, 77.1734],
    "Jharkhand": [23.6102, 85.2799],
    "Karnataka": [15.3173, 75.7139],
    "Kerala": [10.8505, 76.2711],
    "Madhya Pradesh": [22.9734, 78.6569],
    "Maharashtra": [19.7515, 75.7139],
    "Manipur": [24.6637, 93.9063],
    "Meghalaya": [25.4670, 91.3662],
    "Mizoram": [23.1645, 92.9376],
    "Nagaland": [26.1584, 94.5624],
    "Odisha": [20.9517, 85.0985],
    "Punjab": [31.1471, 75.3412],
    "Rajasthan": [27.0238, 74.2179],
    "Sikkim": [27.5330, 88.5122],
    "Tamil Nadu": [11.1271, 78.6569],
    "Telangana": [18.1124, 79.0193],
    "Tripura": [23.9408, 91.9882],
    "Uttar Pradesh": [26.8467, 80.9462],
    "Uttarakhand": [30.0668, 79.0193],
    "West Bengal": [22.9868, 87.8550],
    "Andaman and Nicobar Islands": [11.7401, 92.6586],
    "Chandigarh": [30.7333, 76.7794],
    "Dadra and Nagar Haveli and Daman and Diu": [20.3974, 72.8370],
    "Delhi": [28.7041, 77.1025],
    "Jammu and Kashmir": [33.7782, 76.5762],
    "Ladakh": [34.1526, 77.5771],
    "Lakshadweep": [10.5667, 72.6417],
    "Puducherry": [11.9416, 79.8083]
  };
  
  function getLatLon(stateName) {
    return statesData[stateName] || "State not found";
  }
  
  // Example usage:
  console.log(getLatLon("Karnataka")); // Output: [15.3173, 75.7139]
  
  useEffect(() => {
    if (containerRef.current) {
      Cesium.Ion.defaultAccessToken = process.env.REACT_APP_CESIUM_ION_ACCESS_TOKEN; // Replace with your actual token

      viewer = new Cesium.Viewer(containerRef.current, {
        navigationHelpButton: false,
        animation: false,
        timeline: false
      });

      const processFeature = async (feature) => {
        try {
          let data = feature.geometry.type === 'Polygon' ? feature.geometry.coordinates[0] : feature.geometry.coordinates.flat(2);
          const stateName = feature.properties["NAME_1"];
          const centroid = calculateCentroid(data);
          const [longitude, latitude] = centroid;

          const simplifiedData = simplifyGeometry(data, 100); // Reduce to 100 points
          const flattenedCoordinates = simplifiedData.flatMap(coord => [coord[0], coord[1]]);

          // Validate the coordinates
          if (!flattenedCoordinates.every(coord => typeof coord === 'number')) {
            console.error('Invalid coordinates:', flattenedCoordinates);
            return;
          }

          const temperature = await fetchTemperature(latitude, longitude);

          // Add polygon with outline using Primitive
          /* const polygonInstance = new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flattenedCoordinates)),
              perPositionHeight: true
            }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.TRANSPARENT.withAlpha(0.1))
            },
            id: stateName
          });

          const outlineInstance = new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonOutlineGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(flattenedCoordinates)),
              perPositionHeight: true
            }),
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED)
            },
            id: stateName
          });

          viewer.scene.primitives.add(new Cesium.Primitive({
            geometryInstances: [polygonInstance, outlineInstance],
            appearance: new Cesium.PerInstanceColorAppearance({
              flat: true,
              renderState: {
                depthTest: {
                  enabled: true
                }
              }
            })
          })); */
     

          // Add point for the centroid
          viewer.entities.add({
            name: stateName,
            position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flattenedCoordinates),
              width: 2,
              material: Cesium.Color.TRANSPARENT
            },
            point: {
              pixelSize: 10,
              color: Cesium.Color.RED,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2
            },
            billboard: {
              image: createBarGraphImage(temperature),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
            },
            label: {
              text: stateName,
              font: '14px sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              pixelOffset: new Cesium.Cartesian2(0, -80)
            }
          });
        } catch (error) {
          console.error('Error processing feature:', feature, error);
        }
      };

      const processFeaturesInBatches = async (features, batchSize) => {
        for (let i = 0; i < features.length; i += batchSize) {
          const batch = features.slice(i, i + batchSize);
          await Promise.all(batch.map(processFeature));
        }
      };

      processFeaturesInBatches(geoJsonData.features, 10).then(() => {
        viewer.zoomTo(viewer.entities);
      });
      const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
      try{
      let highlightedEntity = null; // Track the currently highlighted entity

      handler.setInputAction((movement) => {
        const pickedObject = viewer.scene.pick(movement.endPosition);
        if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.polyline) {
          if (highlightedEntity) {
            highlightedEntity.polyline.material = Cesium.Color.TRANSPARENT; // Reset previous entity color
            highlightedEntity.polyline.width = 2;
          }
          highlightedEntity = pickedObject.id; // Update the highlighted entity
          highlightedEntity.polyline.material = Cesium.Color.YELLOW; // Change to yellow
          highlightedEntity.polyline.width = 2;
          const stateName = highlightedEntity.name; // Adjust based on your GeoJSON structure
          setHighlightedStateName(stateName); // Update the state with the highlighted state name
        } else {
          if (highlightedEntity) {
            highlightedEntity.polyline.material = Cesium.Color.TRANSPARENT; // Reset previous entity color
            highlightedEntity.polyline.width = 2;
          }
          highlightedEntity = null; // Reset if no entity is picked
          setHighlightedStateName(''); // Clear the highlighted state name
        }
      }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    } catch(error){
      console.log(error);
    }
  

      return () => {
        if (viewer) {
          viewer.destroy();
        }
      };
    }
  }, []);

  const calculateCentroid = (coordinates) => {
    const [sumLon, sumLat] = coordinates.reduce(
      ([sumLon, sumLat], [lng, lat]) => [sumLon + lng, sumLat + lat],
      [0, 0]
    );

    const numPoints = coordinates.length;
    return [sumLon / numPoints, sumLat / numPoints];
  };

  const simplifyGeometry = (coordinates, maxPoints) => {
    if (coordinates.length <= maxPoints) {
      return coordinates;
    }

    const step = Math.ceil(coordinates.length / maxPoints);
    return coordinates.filter((_, index) => index % step === 0);
  };

  const getBarColor = (value) => {
    if (value < 0) return '#00BFFF'; // Deep Sky Blue
    if (value < 10) return '#ADD8E6'; // Light Blue
    if (value < 20) return '#98FB98'; // Pale Green
    if (value < 30) return '#FFFF00'; // Yellow
    if (value < 40) return '#FFA500'; // Orange
    return '#FF4500'; // Orange Red
  };

  const fetchTemperature = async (latitude, longitude) => {
    const apiKey = process.env.REACT_APP_OPENWEATHERMAP_API_KEY; // Replace with your OpenWeatherMap API key
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&units=metric&appid=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    return data.main.temp; // Return the temperature in Celsius
  };

  const createBarGraphImage = (value) => {
    const canvas = document.createElement('canvas');
    canvas.width = 50;
    canvas.height = 100;
    const context = canvas.getContext('2d');

    // Draw the bar graph
    const barHeight = (value + 10) * 2; // Adjust the height based on the temperature range
    context.fillStyle = getBarColor(value);
    context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    // Draw the value text inside the bar
    context.fillStyle = value < 40 ? 'black' : 'white';
    context.font = '12px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(`${value}°C`, canvas.width / 2, canvas.height - barHeight + 15);

    return canvas.toDataURL();
  };

  return (
    <div className="cesium-container">
      <div style={{ height: "95vh", margin: "5px" }} ref={containerRef} className="cesium-content"></div>
    </div>
  );
};

export default CesiumContainer;