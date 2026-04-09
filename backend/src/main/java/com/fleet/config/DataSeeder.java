package com.fleet.config;

import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import com.fleet.modules.maintenance.repository.MaintenanceAlertRepository;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripPriority;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedFleetData(
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        MaintenanceAlertRepository maintenanceAlertRepository,
        RoutePlanRepository routePlanRepository,
        TripRepository tripRepository,
        AppUserRepository appUserRepository,
        TelemetryRepository telemetryRepository,
        PasswordEncoder passwordEncoder
    ) {
        return args -> {
            if (vehicleRepository.count() == 0) {
                vehicleRepository.saveAll(List.of(
                    new Vehicle("VH-101", "Atlas Prime", "Heavy Truck", "Active", "Mumbai Hub", 72, 128540, "DR-201"),
                    new Vehicle("VH-102", "Coastal Runner", "Reefer Van", "Idle", "Pune Depot", 54, 87920, "DR-202"),
                    new Vehicle("VH-103", "Northline Carrier", "Flatbed", "Maintenance", "Nagpur Service Bay", 31, 165210, "DR-203"),
                    new Vehicle("VH-104", "Urban Sprint", "Light Commercial", "Active", "Bengaluru Last-Mile Center", 81, 43180, "DR-204")
                ));
            }

            if (driverRepository.count() == 0) {
                driverRepository.saveAll(List.of(
                    new Driver("DR-201", "Aarav Sharma", "On Duty", "HMV", "VH-101", 5.2),
                    new Driver("DR-202", "Nisha Patel", "Resting", "LMV", "VH-102", 3.4),
                    new Driver("DR-203", "Rohan Verma", "Off Duty", "HMV", "VH-103", 0),
                    new Driver("DR-204", "Ishita Mehra", "On Duty", "Transport", "VH-104", 6.1)
                ));
            }

            if (maintenanceAlertRepository.count() == 0) {
                maintenanceAlertRepository.saveAll(List.of(
                    new MaintenanceAlert("MA-1", "VH-103", "Brake pad replacement", "Critical", LocalDate.parse("2026-04-04"), "Brake wear threshold exceeded during latest inspection."),
                    new MaintenanceAlert("MA-2", "VH-101", "Oil pressure inspection", "Medium", LocalDate.parse("2026-04-06"), "Oil pressure trend dipped below preferred baseline."),
                    new MaintenanceAlert("MA-3", "VH-102", "Refrigeration calibration", "Low", LocalDate.parse("2026-04-08"), "Temperature drift detected during cold-chain simulation.")
                ));
            }

            if (routePlanRepository.count() == 0) {
                routePlanRepository.saveAll(List.of(
                    new RoutePlan("RT-501", "Western Corridor Morning Run", "In Progress", 342, "6h 15m", List.of("Mumbai Hub", "Lonavala", "Pune Depot", "Satara Crossdock")),
                    new RoutePlan("RT-502", "Central Maintenance Loop", "Scheduled", 184, "3h 40m", List.of("Nagpur Service Bay", "Wardha", "Amravati")),
                    new RoutePlan("RT-503", "Southern Last-Mile Sweep", "Completed", 96, "2h 10m", List.of("Bengaluru Center", "Indiranagar", "Whitefield", "Yelahanka"))
                ));
            }

            if (tripRepository.count() == 0) {
                tripRepository.saveAll(List.of(
                    new Trip(
                        "TRIP-1001",
                        "RT-501",
                        "VH-101",
                        "DR-201",
                        "Mumbai Hub",
                        "Pune Depot",
                        TripStatus.IN_PROGRESS,
                        TripPriority.HIGH,
                        TripDispatchStatus.DISPATCHED,
                        TripComplianceStatus.COMPLIANT,
                        TripOptimizationStatus.OPTIMIZED,
                        LocalDateTime.now().minusHours(1),
                        LocalDateTime.now().plusHours(5),
                        LocalDateTime.now().minusMinutes(35),
                        null,
                        342,
                        128,
                        "6h 15m",
                        "2h 10m",
                        "Morning dispatch in motion.",
                        List.of("Mumbai Hub", "Lonavala", "Pune Depot", "Satara Crossdock")
                    )
                ));
            }

            if (appUserRepository.count() == 0) {
                appUserRepository.save(
                    new AppUser(
                        "USR-1",
                        "Shreya Operations",
                        "Fleet Operations Manager",
                        "shreya.ops@fleetcontrol.dev",
                        "West and South India",
                        "manager@fleetcontrol.dev",
                        passwordEncoder.encode("password123")
                    )
                );
            } else {
                appUserRepository.findAll().forEach(user -> {
                    if (user.getPassword() != null && !user.getPassword().startsWith("$2")) {
                        user.setPassword(passwordEncoder.encode(user.getPassword()));
                        appUserRepository.save(user);
                    }
                });
            }

            if (telemetryRepository.count() == 0) {
                telemetryRepository.saveAll(List.of(
                    createTelemetry("VH-101", "TRIP-1001", 19.0760, 72.8777, 48, 74, 25),
                    createTelemetry("VH-101", "TRIP-1001", 19.1136, 72.8697, 56, 70, 20),
                    createTelemetry("VH-101", "TRIP-1001", 19.1480, 72.9310, 62, 66, 15),
                    createTelemetry("VH-101", "TRIP-1001", 19.2010, 73.0169, 54, 61, 10),
                    createTelemetry("VH-101", "TRIP-1001", 19.2183, 73.0844, 45, 58, 5)
                ));
            }
        };
    }

    private Telemetry createTelemetry(
        String vehicleId,
        String tripId,
        double latitude,
        double longitude,
        double speed,
        double fuelLevel,
        int minutesAgo
    ) {
        Telemetry telemetry = new Telemetry();
        telemetry.setVehicleId(vehicleId);
        telemetry.setTripId(tripId);
        telemetry.setLatitude(latitude);
        telemetry.setLongitude(longitude);
        telemetry.setSpeed(speed);
        telemetry.setFuelLevel(fuelLevel);
        telemetry.setTimestamp(LocalDateTime.now().minusMinutes(minutesAgo));
        return telemetry;
    }
}
