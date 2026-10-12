package com.smartcommunity.repository;

import com.smartcommunity.entity.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, Long> {
    List<Complaint> findByResidentIdOrderByCreatedAtDesc(Long residentId);
    List<Complaint> findByAssignedWorkerIdOrderByCreatedAtDesc(Long assignedWorkerId);
    List<Complaint> findByStatusNotIgnoreCase(String status);
}
