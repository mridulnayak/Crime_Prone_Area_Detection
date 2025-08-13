// static/js/map.js
const map = L.map('map').setView([21.25, 81.63], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let userMarker = null;
let userCircle = null;
let currentLocality = null; // to detect when user enters a new area
let zonesLayer = L.layerGroup().addTo(map);

// small helper to choose color from safety
function colorForSafety(safety) {
  if (!safety) return '#007bff';
  const s = safety.toString().toLowerCase();
  if (s.includes('low')) return '#2ecc71'; // green
  if (s.includes('medium')) return '#f39c12'; // orange
  if (s.includes('high')) return '#e74c3c'; // red
  return '#3498db';
}

// load zones and draw circles
function loadZones() {
  fetch('/zones')
    .then(r => r.json())
    .then(data => {
      zonesLayer.clearLayers();
      data.forEach(loc => {
        const lat = parseFloat(loc.latitude);
        const lon = parseFloat(loc.longitude);
        const color = colorForSafety(loc.safety_level);
        const radius = 700; // meters for circle size — adjust per need

        const circle = L.circle([lat, lon], {
          color: color,
          fillColor: color,
          fillOpacity: 0.25,
          radius: radius,
          weight: 1
        });

        circle.addTo(zonesLayer);

        circle.on('click', () => {
          showInfoBox({
            title: `${loc.locality}, ${loc.district}`,
            content: `
              <div class="info-row"><strong>Crime Rate:</strong> ${loc.crime_rate_per_100k} per 100k</div>
              <div class="info-row"><strong>Total Crimes:</strong> ${loc.total_crimes}</div>
              <div class="info-row"><strong>Safety:</strong> ${loc.safety_level}</div>
            `
          });
        });
      });
    })
    .catch(err => console.error('Error loading zones:', err));
}

// show a floating info box
function showInfoBox({ title, content }) {
  const box = document.getElementById('info-box');
  const contentDiv = document.getElementById('info-content');
  contentDiv.innerHTML = `<h3 style="margin:0 0 8px 0">${title}</h3>${content}`;
  box.hidden = false;
}
document.getElementById('info-close').addEventListener('click', () => {
  document.getElementById('info-box').hidden = true;
});

// update user location -> query backend for nearest area
function updateLocation(lat, lon) {
  fetch(`/crime-info?lat=${lat}&lon=${lon}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        console.error('crime-info error:', data.error);
        return;
      }

      // set or move marker
      if (!userMarker) {
        userMarker = L.marker([lat, lon]).addTo(map);
      } else {
        userMarker.setLatLng([lat, lon]);
      }

      // small circle around user (optional)
      if (!userCircle) {
        userCircle = L.circle([lat, lon], { radius: 30, color: '#007bff', fillOpacity: 0.2 }).addTo(map);
      } else {
        userCircle.setLatLng([lat, lon]);
      }

      // If locality changed, update popup and info
      if (currentLocality !== data.locality) {
        currentLocality = data.locality; // update current area

        // Build popup content including bar visual
        const popupHtml = `
          <div style="min-width:180px">
            <b>${data.locality}, ${data.district}</b><br/>
            <div style="margin-top:6px;"><strong>Crime rate:</strong> ${data.crime_rate_per_100k} per 100k</div>
            <div><strong>Total crimes:</strong> ${data.total_crimes}</div>
            <div><strong>Safety:</strong> ${data.safety_level}</div>
            <div style="margin-top:8px">
              <div class="bar-visual"><div class="bar-fill" id="bar-fill" style="background:${data.bar_color}; width:0%"></div></div>
              <div style="font-family: monospace; margin-top:6px; color:${data.bar_color}">${data.bar}</div>
            </div>
            <div style="margin-top:6px; font-size:12px; color:#666">Distance to center: ${data.distance_km} km</div>
          </div>
        `;

        userMarker.bindPopup(popupHtml).openPopup();

        // animate the bar fill after a short delay
        setTimeout(() => {
          try {
            const barFill = document.getElementById('bar-fill');
            if (barFill) {
              // width percentage from bar length (count blocks)
              const filledCount = (data.bar.match(/█/g) || []).length;
              const percent = Math.round((filledCount / 10) * 100);
              barFill.style.width = percent + '%';
            }
          } catch (e) { /* ignore */ }
        }, 200);
      } else {
        // locality same — still update marker popup data silently if needed
        userMarker.getPopup() && userMarker.getPopup().setContent(userMarker.getPopup().getContent());
      }
    })
    .catch(err => console.error('Error fetching crime-info:', err));
}

// watch position
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(position => {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    map.setView([lat, lon], 15); // center as user moves
    updateLocation(lat, lon);
  }, err => {
    console.error('Geolocation error:', err);
    alert('Location access is required for live tracking. Please allow location access.');
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 });
} else {
  alert('Geolocation not supported by your browser.');
}

// initial load
loadZones();
