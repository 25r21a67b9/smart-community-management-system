package com.smartcommunity.repository;

import com.smartcommunity.entity.Worker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkerRepository extends JpaRepository<Worker, Long> {
    List<Worker> findBySpecializationIgnoreCaseAndStatusIgnoreCase(String specialization, String status);
    boolean existsByPhone(String phone);
}
