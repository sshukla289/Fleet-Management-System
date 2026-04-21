package com.fleet.modules.auth.repository;

import com.fleet.modules.auth.entity.AppUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AppUserRepository extends JpaRepository<AppUser, String>, JpaSpecificationExecutor<AppUser> {
    Optional<AppUser> findByLoginEmailIgnoreCase(String loginEmail);
    Optional<AppUser> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, String id);

    boolean existsByLoginEmailIgnoreCase(String loginEmail);

    boolean existsByLoginEmailIgnoreCaseAndIdNot(String loginEmail, String id);
}
