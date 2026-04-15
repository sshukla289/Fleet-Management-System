-- MySQL Schema for Role-Based Fleet Management System

CREATE DATABASE IF NOT EXISTS fleet_db;
USE fleet_db;

-- 1. ROLES TABLE
-- Defines the operational roles within the system
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. USERS TABLE
-- Core identity table with role integration
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    login_email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) NOT NULL,
    assigned_region VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 3. VEHICLES TABLE
-- Fleet asset management
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status ENUM('Active', 'Idle', 'Maintenance') DEFAULT 'Idle',
    current_location VARCHAR(255),
    fuel_level DECIMAL(5, 2) DEFAULT 0.00,
    mileage INT DEFAULT 0,
    assigned_driver_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehicle_driver FOREIGN KEY (assigned_driver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. TRIPS TABLE
-- Trip execution and execution state
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(50) PRIMARY KEY,
    route_id VARCHAR(50) NOT NULL,
    vehicle_id VARCHAR(50) NOT NULL,
    driver_id VARCHAR(50) NOT NULL,
    status ENUM('DRAFT', 'VALIDATED', 'OPTIMIZED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'BLOCKED') DEFAULT 'DRAFT',
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    source VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    est_distance DECIMAL(10, 2),
    actual_distance DECIMAL(10, 2),
    est_duration VARCHAR(50),
    actual_duration VARCHAR(50),
    dispatch_status VARCHAR(50),
    compliance_status VARCHAR(50),
    optimization_status VARCHAR(50),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_trip_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
    CONSTRAINT fk_trip_driver FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- 5. ALERTS TABLE
-- Exception management and event tracking
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(50) PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    status ENUM('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') DEFAULT 'OPEN',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    vehicle_id VARCHAR(50),
    trip_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_alert_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    CONSTRAINT fk_alert_trip FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- SAMPLE SEED DATA
INSERT INTO roles (id, name, description) VALUES 
('R1', 'ADMIN', 'Full system access'),
('R2', 'OPERATIONS_MANAGER', 'Fleet health and KPI monitoring'),
('R3', 'DISPATCHER', 'Live trip monitoring and driver assignment'),
('R4', 'PLANNER', 'Route optimization and trip scheduling'),
('R5', 'MAINTENANCE_MANAGER', 'Vehicle health and service scheduling'),
('R6', 'DRIVER', 'Field execution and telemetry updates');
