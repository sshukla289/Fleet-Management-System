package com.fleet.config;

import com.fleet.modules.alert.entity.Alert;
import com.fleet.modules.alert.entity.AlertCategory;
import com.fleet.modules.alert.entity.AlertLifecycleStatus;
import com.fleet.modules.alert.entity.AlertSeverity;
import com.fleet.modules.alert.repository.AlertRepository;
import com.fleet.modules.auth.entity.AppUser;
import com.fleet.modules.auth.entity.AppRole;
import com.fleet.modules.auth.repository.AppUserRepository;
import com.fleet.modules.driver.entity.Driver;
import com.fleet.modules.driver.entity.DriverDutyStatus;
import com.fleet.modules.driver.repository.DriverRepository;
import com.fleet.modules.maintenance.entity.MaintenanceAlert;
import com.fleet.modules.maintenance.entity.MaintenanceSchedule;
import com.fleet.modules.maintenance.entity.MaintenanceScheduleStatus;
import com.fleet.modules.maintenance.repository.MaintenanceAlertRepository;
import com.fleet.modules.maintenance.repository.MaintenanceScheduleRepository;
import com.fleet.modules.route.entity.RoutePlan;
import com.fleet.modules.route.repository.RoutePlanRepository;
import com.fleet.modules.telemetry.entity.Telemetry;
import com.fleet.modules.telemetry.repository.TelemetryRepository;
import com.fleet.modules.trip.entity.StopStatus;
import com.fleet.modules.trip.entity.Trip;
import com.fleet.modules.trip.entity.TripStop;

import com.fleet.modules.trip.entity.TripComplianceStatus;
import com.fleet.modules.trip.entity.TripDispatchStatus;
import com.fleet.modules.trip.entity.TripOptimizationStatus;
import com.fleet.modules.trip.entity.TripPriority;
import com.fleet.modules.trip.entity.TripStatus;
import com.fleet.modules.trip.repository.TripRepository;
import com.fleet.modules.vehicle.entity.Vehicle;
import com.fleet.modules.vehicle.entity.VehicleOperationalStatus;
import com.fleet.modules.vehicle.repository.VehicleRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    @Bean
    @ConditionalOnProperty(value = "app.seed.enabled", havingValue = "true")
    CommandLineRunner seedFleetData(
        VehicleRepository vehicleRepository,
        DriverRepository driverRepository,
        MaintenanceAlertRepository maintenanceAlertRepository,
        MaintenanceScheduleRepository maintenanceScheduleRepository,
        AlertRepository alertRepository,
        RoutePlanRepository routePlanRepository,
        TripRepository tripRepository,
        AppUserRepository appUserRepository,
        TelemetryRepository telemetryRepository,
        PasswordEncoder passwordEncoder
    ) {
        return args -> {
            if (vehicleRepository.count() == 0) {
                vehicleRepository.saveAll(List.of(
                    new Vehicle("VH-101", "Atlas Prime", "Heavy Truck", VehicleOperationalStatus.ACTIVE.value(), "Mumbai Hub", 72, 128540, "DR-201"),
                    new Vehicle("VH-102", "Coastal Runner", "Reefer Van", VehicleOperationalStatus.IDLE.value(), "Pune Depot", 54, 87920, "DR-202"),
                    new Vehicle("VH-103", "Northline Carrier", "Flatbed", VehicleOperationalStatus.MAINTENANCE.value(), "Nagpur Service Bay", 31, 165210, "DR-203"),
                    new Vehicle("VH-104", "Urban Sprint", "Light Commercial", VehicleOperationalStatus.ACTIVE.value(), "Bengaluru Last-Mile Center", 81, 43180, "DR-204")
                ));
            }

            if (driverRepository.count() == 0) {
                driverRepository.saveAll(List.of(
                    new Driver("DR-201", "Aarav Sharma", DriverDutyStatus.ON_DUTY.value(), "HMV", "VH-101", 5.2),
                    new Driver("DR-202", "Nisha Patel", DriverDutyStatus.RESTING.value(), "LMV", "VH-102", 3.4),
                    new Driver("DR-203", "Rohan Verma", DriverDutyStatus.OFF_DUTY.value(), "HMV", "VH-103", 0),
                    new Driver("DR-204", "Ishita Mehra", DriverDutyStatus.ON_DUTY.value(), "Transport", "VH-104", 6.1)
                ));
            }

            if (maintenanceAlertRepository.count() == 0) {
                maintenanceAlertRepository.saveAll(List.of(
                    new MaintenanceAlert("MA-1", "VH-103", "Brake pad replacement", "Critical", LocalDate.parse("2026-04-04"), "Brake wear threshold exceeded during latest inspection."),
                    new MaintenanceAlert("MA-2", "VH-101", "Oil pressure inspection", "Medium", LocalDate.parse("2026-04-06"), "Oil pressure trend dipped below preferred baseline."),
                    new MaintenanceAlert("MA-3", "VH-102", "Refrigeration calibration", "Low", LocalDate.parse("2026-04-08"), "Temperature drift detected during cold-chain simulation.")
                ));
            }

            if (maintenanceScheduleRepository.count() == 0) {
                maintenanceScheduleRepository.saveAll(List.of(
                    new MaintenanceSchedule(
                        "MS-1",
                        "VH-103",
                        "Brake inspection bay visit",
                        MaintenanceScheduleStatus.PLANNED,
                        LocalDate.now(),
                        LocalDate.now().plusDays(1),
                        true,
                        "BRAKE_INSPECTION",
                        "Blocks dispatch until brake system inspection is signed off.",
                        LocalDateTime.now(),
                        LocalDateTime.now()
                    ),
                    new MaintenanceSchedule(
                        "MS-2",
                        "VH-102",
                        "Refrigeration recalibration",
                        MaintenanceScheduleStatus.IN_PROGRESS,
                        LocalDate.now(),
                        LocalDate.now().plusDays(2),
                        true,
                        "COLD_CHAIN",
                        "Cold chain unit requires recalibration before release.",
                        LocalDateTime.now(),
                        LocalDateTime.now()
                    )
                ));
            }

            if (alertRepository.count() == 0) {
                alertRepository.saveAll(List.of(
                    new Alert(
                        "AL-1",
                        AlertCategory.MAINTENANCE,
                        AlertSeverity.CRITICAL,
                        AlertLifecycleStatus.OPEN,
                        "Brake pad replacement",
                        "Brake wear threshold exceeded during latest inspection.",
                        "maintenance",
                        "MA-1",
                        null,
                        "VH-103",
                        "{\"reasonCode\":\"BRAKE_INSPECTION\"}",
                        LocalDateTime.now().minusHours(6),
                        LocalDateTime.now().minusHours(6)
                    ),
                    new Alert(
                        "AL-2",
                        AlertCategory.COMPLIANCE,
                        AlertSeverity.HIGH,
                        AlertLifecycleStatus.ACKNOWLEDGED,
                        "Driver hour review",
                        "Trip TRIP-1002 is blocked by duty-hour and license checks.",
                        "compliance",
                        "TRIP-1002",
                        "TRIP-1002",
                        "VH-103",
                        "{\"blockingReasons\":[\"Driver is off duty and cannot be dispatched.\",\"Vehicle is in maintenance and cannot be dispatched.\"]}",
                        LocalDateTime.now().minusHours(3),
                        LocalDateTime.now().minusHours(1)
                    ),
                    new Alert(
                        "AL-3",
                        AlertCategory.LOW_FUEL,
                        AlertSeverity.MEDIUM,
                        AlertLifecycleStatus.OPEN,
                        "Fuel reserve warning",
                        "Vehicle VH-102 fuel level dropped below the preferred threshold.",
                        "telemetry",
                        "VH-102",
                        null,
                        "VH-102",
                        "{\"fuelLevel\":18}",
                        LocalDateTime.now().minusHours(2),
                        LocalDateTime.now().minusHours(2)
                    )
                ));
            }

            if (routePlanRepository.count() == 0) {
                routePlanRepository.saveAll(List.of(
                    new RoutePlan("RT-501", "Western Corridor Morning Run", "In Progress", 342, "6h 15m", List.of(
                        new TripStop("Mumbai Hub", 1, StopStatus.COMPLETED),
                        new TripStop("Lonavala", 2, StopStatus.COMPLETED),
                        new TripStop("Pune Depot", 3, StopStatus.IN_PROGRESS),
                        new TripStop("Satara Crossdock", 4, StopStatus.PENDING)
                    )),
                    new RoutePlan("RT-502", "Central Maintenance Loop", "Scheduled", 184, "3h 40m", List.of(
                        new TripStop("Nagpur Service Bay", 1, StopStatus.PENDING),
                        new TripStop("Wardha", 2, StopStatus.PENDING),
                        new TripStop("Amravati", 3, StopStatus.PENDING)
                    )),
                    new RoutePlan("RT-503", "Southern Last-Mile Sweep", "Completed", 96, "2h 10m", List.of(
                        new TripStop("Bengaluru Center", 1, StopStatus.COMPLETED),
                        new TripStop("Indiranagar", 2, StopStatus.COMPLETED),
                        new TripStop("Whitefield", 3, StopStatus.COMPLETED),
                        new TripStop("Yelahanka", 4, StopStatus.COMPLETED)
                    ))
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
                        LocalDateTime.now().minusHours(2),
                        LocalDateTime.now().minusMinutes(30),
                        LocalDateTime.now().minusMinutes(35),
                        null,
                        342,
                        128,
                        "6h 15m",
                        "2h 10m",
                        "Morning dispatch in motion.",
                        List.of(
                            new TripStop("Mumbai Hub", 1, StopStatus.COMPLETED),
                            new TripStop("Lonavala", 2, StopStatus.COMPLETED),
                            new TripStop("Pune Depot", 3, StopStatus.IN_PROGRESS),
                            new TripStop("Satara Crossdock", 4, StopStatus.PENDING)
                        )
                    ),
                    new Trip(
                        "TRIP-1002",
                        "RT-502",
                        "VH-103",
                        "DR-203",
                        "Nagpur Service Bay",
                        "Amravati",
                        TripStatus.BLOCKED,
                        TripPriority.CRITICAL,
                        TripDispatchStatus.NOT_DISPATCHED,
                        TripComplianceStatus.BLOCKED,
                        TripOptimizationStatus.OPTIMIZED,
                        LocalDateTime.now().minusHours(4),
                        LocalDateTime.now().minusHours(1),
                        null,
                        null,
                        184,
                        0,
                        "3h 40m",
                        null,
                        "Blocked by maintenance and compliance checks.",
                        List.of(
                            new TripStop("Nagpur Service Bay", 1, StopStatus.PENDING),
                            new TripStop("Wardha", 2, StopStatus.PENDING),
                            new TripStop("Amravati", 3, StopStatus.PENDING)
                        )
                    )
                ));
            }

            upsertUser(appUserRepository, passwordEncoder, "USR-1", "Operations Manager Console", AppRole.OPERATIONS_MANAGER, "operations_manager@gmail.com", "West and South India", "operations_manager@gmail.com", "password");
            upsertUser(appUserRepository, passwordEncoder, "USR-2", "Super Admin Console", AppRole.ADMIN, "admin@gmail.com", "Global", "admin@gmail.com", "password");
            upsertUser(appUserRepository, passwordEncoder, "USR-3", "Dispatcher Console", AppRole.DISPATCHER, "dispatcher@gmail.com", "West Corridor", "dispatcher@gmail.com", "password");
            upsertUser(appUserRepository, passwordEncoder, "USR-5", "Route Planner Console", AppRole.PLANNER, "planner@gmail.com", "Regional Hubs", "planner@gmail.com", "password");
            upsertUser(appUserRepository, passwordEncoder, "USR-4", "Maintenance Manager Console", AppRole.MAINTENANCE_MANAGER, "maintenance_manager@gmail.com", "Workshop Bay", "maintenance_manager@gmail.com", "password");
            upsertUser(appUserRepository, passwordEncoder, "DR-201", "Driver Execution Console", AppRole.DRIVER, "driver@gmail.com", "Field Operations", "driver@gmail.com", "password");

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

    private Telemetry createTelemetry(String vehicleId, String tripId, double latitude, double longitude, double speed, double fuelLevel, int minutesAgo) {
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

    private void upsertUser(AppUserRepository appUserRepository, PasswordEncoder passwordEncoder, String id, String name, AppRole role, String email, String assignedRegion, String loginEmail, String rawPassword) {
        AppUser user = appUserRepository.findById(id).orElse(null);
        if (user == null) {
            user = appUserRepository.findByLoginEmailIgnoreCase(loginEmail).orElse(null);
        }
        if (user == null) {
            user = new AppUser();
            user.setId(id);
        }
        user.setLoginEmail(loginEmail);
        user.setName(name);
        user.setRole(role.name());
        user.setEmail(email);
        user.setAssignedRegion(assignedRegion);
        user.setPassword(passwordEncoder.encode(rawPassword));
        appUserRepository.save(user);
    }
}
