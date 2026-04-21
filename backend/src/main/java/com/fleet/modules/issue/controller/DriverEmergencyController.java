package com.fleet.modules.issue.controller;

import com.fleet.modules.issue.dto.CreateIssueRequest;
import com.fleet.modules.issue.dto.CreateSosRequest;
import com.fleet.modules.issue.dto.IssueDTO;
import com.fleet.modules.issue.dto.SosAlertDTO;
import com.fleet.modules.issue.service.DriverEmergencyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class DriverEmergencyController {

    private final DriverEmergencyService driverEmergencyService;

    public DriverEmergencyController(DriverEmergencyService driverEmergencyService) {
        this.driverEmergencyService = driverEmergencyService;
    }

    @PostMapping(value = "/issues", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<IssueDTO> createIssue(@Valid @ModelAttribute CreateIssueRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(driverEmergencyService.reportIssue(request));
    }

    @PostMapping("/sos")
    @PreAuthorize("hasRole('DRIVER')")
    public ResponseEntity<SosAlertDTO> triggerSos(@RequestBody(required = false) CreateSosRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(driverEmergencyService.triggerSos(request));
    }
}
