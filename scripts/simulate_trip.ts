import axios from 'axios';

const TRIP_ID = 'TRIP-1001';
const API_URL = 'http://localhost:8080/api/trips/location/update';

const STOPS = [
    { name: 'Mumbai Hub', lat: 19.0760, lng: 72.8777 },
    { name: 'Lonavala', lat: 18.7546, lng: 73.4062 },
    { name: 'Pune Depot', lat: 18.5204, lng: 73.8567 },
    { name: 'Satara Crossdock', lat: 17.6805, lng: 73.9915 }
];

async function simulate() {
    console.log(`Starting simulation for ${TRIP_ID}...`);

    for (let i = 0; i < STOPS.length; i++) {
        const stop = STOPS[i];
        
        // Move towards the stop (3 steps per stop)
        for (let step = 0; step < 3; step++) {
            const payload = {
                tripId: TRIP_ID,
                latitude: stop.lat + (Math.random() * 0.01),
                longitude: stop.lng + (Math.random() * 0.01),
                speed: 40 + Math.random() * 30,
                fuel: 80 - (i * 10) - step,
                currentStop: stop.name,
                status: step === 2 ? 'COMPLETED' : (step === 0 ? 'PENDING' : 'IN_PROGRESS'),
                timestamp: new Date().toISOString()
            };

            try {
                // We need to bypass security or use a token. 
                // For simulation purposes, I'll assume the user might need to provide a token 
                // or I can try to use a basic auth if available.
                // In this environment, I'll just log what would be sent.
                await axios.post(API_URL, payload);
                console.log(`Update sent: ${stop.name} [Step ${step}] - Speed: ${payload.speed.toFixed(1)}`);
            } catch (err) {
                console.error('Failed to send update. Make sure backend is running and you have access.');
            }

            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log('Simulation finished.');
}

simulate();
