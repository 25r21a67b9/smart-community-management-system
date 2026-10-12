package com.smartcommunity.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "residents")
public class Resident {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "resident_code", nullable = false, unique = true, length = 20)
    private String residentCode;

    @NotBlank(message = "Full name is required")
    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;

    @NotBlank(message = "Block is required")
    @Column(nullable = false, length = 10)
    private String block;

    @NotBlank(message = "Flat number is required")
    @Column(name = "flat_number", nullable = false, length = 20)
    private String flatNumber;

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^[0-9+\\-\\s]{10,15}$", message = "Phone number must be 10 to 15 digits")
    @Column(nullable = false, length = 20)
    private String phone;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    @Column(nullable = false, unique = true, length = 120)
    private String email;

    @NotBlank(message = "Resident type (Owner or Tenant) is required")
    @Column(name = "resident_type", nullable = false, length = 20)
    private String residentType;

    @Min(value = 1, message = "Family members must be at least 1")
    @Column(name = "family_members", nullable = false)
    private int familyMembers = 1;

    @Column(name = "registration_date", nullable = false)
    private LocalDate registrationDate = LocalDate.now();

    @Column(nullable = false, length = 20)
    private String status = "Active";

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getResidentCode() { return residentCode; }
    public void setResidentCode(String residentCode) { this.residentCode = residentCode; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getBlock() { return block; }
    public void setBlock(String block) { this.block = block; }
    public String getFlatNumber() { return flatNumber; }
    public void setFlatNumber(String flatNumber) { this.flatNumber = flatNumber; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getResidentType() { return residentType; }
    public void setResidentType(String residentType) { this.residentType = residentType; }
    public int getFamilyMembers() { return familyMembers; }
    public void setFamilyMembers(int familyMembers) { this.familyMembers = familyMembers; }
    public LocalDate getRegistrationDate() { return registrationDate; }
    public void setRegistrationDate(LocalDate registrationDate) { this.registrationDate = registrationDate; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
