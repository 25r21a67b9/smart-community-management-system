package com.smartcommunity.repository;

import com.smartcommunity.entity.Resident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResidentRepository extends JpaRepository<Resident, Long> {
    Optional<Resident> findByEmailIgnoreCase(String email);
    boolean existsByBlockIgnoreCaseAndFlatNumberIgnoreCaseAndStatusIgnoreCase(String block, String flatNumber, String status);
    List<Resident> findByBlockIgnoreCase(String block);
}
