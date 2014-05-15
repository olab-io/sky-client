var satellites = {};
var observer = {};
var map;

// Define home coordinates until the user's location is found.
var home = [41.878247, -87.629767]; // Chicago, IL, USA

var satelliteUpdateInterval = 1000;

function onLocationFound(e) {
    // Save a copy of the location.
    observer["location"] = e;

    // Update the observer marker.
    observer["marker"].setLatLng(e.latlng);

    // Update the observer accuracy marker.
    observer["markerAccuracy"].setLatLng(e.latlng);
    observer["markerAccuracy"].setRadius(e.accuracy / 2);
}

function onLocationError(e) {
    // TODO: Allow user to manually set location.
    alert(e.message);
}

function generateTrajectories() {

    for (name in satellites) {
        
        var locations = new Array();

        // Get the next hour
        for (var i = 0; i < 60 * 1; ++i)
        {
            var m = moment().utc().add('minute', i);

            // Calculate Greenwich Mean Sideareal Time for coordinate transforms.
            var gmst = satellite.gstime_from_date(m.year(), 
                                                  m.month(), 
                                                  m.date(), 
                                                  m.hour(), 
                                                  m.minute(), 
                                                  m.second());

            var position_and_velocity = satellite.propagate(satellites[name]["satrec"], 
                                                            m.year(), 
                                                            m.month(), 
                                                            m.date(), 
                                                            m.hour(), 
                                                            m.minute(), 
                                                            m.second());

            var position_gd = satellite.eci_to_geodetic(position_and_velocity["position"], gmst);

            locations.push(L.latLng(satellite.degrees_lat(position_gd["latitude"]), 
                                    satellite.degrees_long(position_gd["longitude"])));

        }

        satellites[name]["route"] = L.polyline(locations);
        satellites[name]["route"].addTo(map);
    }

     // setTimeout(generateTrajectories, satelliteUpdateInterval);
}

function updateSatellites() {
    var now = moment().utc();

    // Calculate Greenwich Mean Sideareal Time for coordinate transforms.
    var gmst = satellite.gstime_from_date(now.year(), 
                                          now.month(), 
                                          now.date(), 
                                          now.hour(), 
                                          now.minute(), 
                                          now.second());

    // var deg2rad = Math.PI / 180;

    // var observer_gd = {
    //     longitude : observer[.longitude * deg2rad,
    //     latitude  : geoLocation.latitude * deg2rad,
    //     height    : 0
    // };

    for (name in satellites) {
        var position_and_velocity = satellite.propagate(satellites[name]["satrec"], 
                                                        now.year(), 
                                                        now.month(), 
                                                        now.date(), 
                                                        now.hour(), 
                                                        now.minute(), 
                                                        now.second());

        // The position_velocity result is a key-value pair of ECI coordinates.
        // These are the base results from which all other coordinates are derived.
        var position_eci = position_and_velocity["position"];
        var velocity_eci = position_and_velocity["velocity"];

        // You can get ECF, Geodetic, Look Angles, and Doppler Factor.
        var position_ecf   = satellite.eci_to_ecf (position_eci, gmst);

        var velocity_ecf   = satellite.eci_to_ecf (velocity_eci, gmst);


        //var observer_ecf   = satellite.geodetic_to_ecf (observer_gd);
        var position_gd    = satellite.eci_to_geodetic (position_eci, gmst);
        //var look_angles    = satellite.ecf_to_look_angles (observer_gd, position_ecf);
        //var doppler_factor = satellite.doppler_factor (observer_coords_ecf, position_ecf, velocity_ecf);

        // The coordinates are all stored in key-value pairs.
        // ECI and ECF are accessed by "x", "y", "z".
        var satellite_x = position_eci["x"];
        var satellite_y = position_eci["y"];
        var satellite_z = position_eci["z"];

        // Look Angles may be accessed by "azimuth", "elevation", "range_sat".
        // var azimuth   = look_angles["azimuth"];
        // var elevation = look_angles["elevation"];
        // var rangeSat  = look_angles["rangeSat"];

        // Geodetic coords are accessed via "longitude", "latitude", "height".
        var longitude = position_gd["longitude"];
        var latitude  = position_gd["latitude"];
        var height    = position_gd["height"];

        satellites[name]["latlng"] = L.latLng(satellite.degrees_lat(position_gd["latitude"]), 
                                              satellite.degrees_long(position_gd["longitude"]));

        satellites[name]["marker"].setLatLng(satellites[name]["latlng"]);
        
        // console.log(satellites[name].latlng);
     }

     // Update the satellites.
     setTimeout(updateSatellites, satelliteUpdateInterval);
}

function loadTLE(theURL) {
    $.ajax({
        type: 'GET',
        dataType: 'text',
        url: theURL,
        timeout: 5000, // 5 second timeout
        success: function(data, textStatus ) {
            var lines = data.split('\n');
            var numLines = lines.length;

            var currentName = "";
            var currentLine1 = "";
            var currentLine2 = "";

            for (i = 0; i < numLines; i++) {

                var line = lines[i];
                
                if (line.length == 0)
                {
                    continue;
                }

                var firstChar = line.charAt(0);

                if (firstChar == '1')
                {
                    // the first line of a tle
                    currentLine1 = line.trim();
                }
                else if (firstChar == '2')
                {
                    // the second line of a tle
                    currentLine2 = line.trim();

                    // Initialize a satellite record
                    var satrec = satellite.twoline2satrec(currentLine1, currentLine2);

                    // Create a maker and add it to the map.
                    var marker = new L.marker(home).addTo(map);

                    satellites[satrec.satnum] = { 
                        // If there is no name in the TLE, then use the NORARD catalog number.
                        name: currentName ? currentName : satrec.satnum,
                        // Save a copy of the extracted satelite record.
                        satrec: satrec,
                        // Save a marker
                        marker: marker
                    }

                    currentName = "";
                    currentLine1 = "";
                    currentLine2 = "";
                }
                else
                {
                    // line is a satellite name
                    currentName = line.trim();
                }
            }

            generateTrajectories();
            updateSatellites();
        },
        error: function(xhr, textStatus, errorThrown) {
            alert('request failed');
        }
    });
}


$(document).ready(function() {

    // Load the latest satellite TLEs.
	loadTLE('/data/tle/resource.txt');

    // Locate the map element.
    map = L.map('map');

    // Add a tile layer.
    L.tileLayer('http://{s}.tile.stamen.com/toner/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery <a href="http://stamen.com">Stamen</a>'
    }).addTo(map);

    // Add initial observer markers.
    observer["marker"] = new L.marker(home);
    observer["marker"].addTo(map);
    observer["markerAccuracy"] = new L.circle(home, 0);
    observer["markerAccuracy"].addTo(map);

    // Center map on home.
    map.setView(home, 3)

    // Setup success callback for location. 
    map.on('locationfound', onLocationFound);

    // Setup error callback for location. 
    map.on('locationerror', onLocationError);

    // Initialize auto-location.
    map.locate({
        watch: false, // Continuously update the geolocation
        setView: true, // Reset the view when the location is discovered.
        timeout: 10000, // The location timeout before error.
        maxZoom: 12, // Set the maximum zoom level.
        enableHighAccuracy: true // High accuracy hint (http://dev.w3.org/geo/api/spec-source.html#high-accuracy)
    });
});
