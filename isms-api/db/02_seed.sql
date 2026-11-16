-- =============================================================================
-- ISMS stand-in seed data (DEVELOPMENT ONLY)
--
-- Every person, name, address, phone number and email below is INVENTED.
-- Emails use the reserved example.com domain; phone numbers are 555-0xxx
-- placeholders. Nothing here describes a real person.
--
-- Edit freely, but keep the ids consistent (see isms-api/db/README.md for the
-- id map). Join keys: scheduleitems/schedulestudents.RefID = schedules.RefID,
-- schedulestudents.EnrollmentID = enrollments.RefID,
-- enrollments.StudentID = students.RefID, scheduleitems.InstructorID =
-- employees.RefID, schedules.SectionID = educsections.ID.
-- =============================================================================

USE `isms_dev`;


-- School years: ID 1 = 2025-2026 (past), ID 2 = 2026-2027 (current, Standing = '1')
INSERT INTO `isms_dev`.`schoolyear_tbl` (`ID`, `SYFrom`, `SYTo`, `Standing`, `Status`) VALUES
  (1, 2025, 2026, '0', '1'),
  (2, 2026, 2027, '1', '1');

-- Semesters: ID 1 = current (StandingID = '1')
INSERT INTO `isms_dev`.`semester_tbl` (`ID`, `Name`, `StandingID`, `Status`) VALUES
  (1, '1st Semester', '1', '1'),
  (2, '2nd Semester', '0', '1'),
  (3, 'Summer', '0', '1');

-- Sections (BSIT program = ProgramID 1, BranchID 1)
INSERT INTO `isms_dev`.`educsections_tbl` (`ID`, `BranchID`, `YearID`, `ProgramID`, `Name`, `MaxCapacity`, `Remarks`, `Status`) VALUES
  (1, '1', '1', '1', 'BSIT 1-A', 40, 'First year block A', '1'),
  (2, '1', '2', '1', 'BSIT 2-A', 40, 'Second year block A', '1'),
  (3, '1', '3', '1', 'BSIT 3-A', 40, 'Third year block A', '1');

-- Employees: EMP-0001..0005 active instructors, EMP-0006 INACTIVE instructor, EMP-0007 non-teaching staff
INSERT INTO `isms_dev`.`employees_tbl` (`ID`, `RefID`, `EmpNo`, `UserName`, `FName`, `MName`, `LName`, `Suffix`, `Honorific`, `BDate`, `Sex`, `Address`, `ContactNo`, `Email`, `Position`, `DepartmentID`, `IsGradesEditor`, `SubjectsHandled`, `EducationLevel`, `EducationRemarks`, `Course`, `Status`) VALUES
  (1, 'EMP-0001', 'E-1001', 'lmarvale', 'Liora', 'Santos', 'Marvale', '', 'Prof.', '1984-03-12', 'F', '100 Sample Street, Testville', '555-0110', 'lmarvale@staff.example.com', 'Instructor', '1', 1, 'IT101,IT102', 'Masters', 'Fictional record', 'Information Technology', '1'),
  (2, 'EMP-0002', 'E-1002', 'tquenby', 'Tobin', 'Reyes', 'Quenby', '', 'Mr.', '1988-07-04', 'M', '101 Sample Street, Testville', '555-0111', 'tquenby@staff.example.com', 'Instructor', '1', 1, 'IT103,IT201', 'Bachelors', 'Fictional record', 'Information Technology', '1'),
  (3, 'EMP-0003', 'E-1003', 'nasterwood', 'Nerissa', 'Cruz', 'Asterwood', '', 'Dr.', '1979-11-23', 'F', '102 Sample Street, Testville', '555-0112', 'nasterwood@staff.example.com', 'Instructor', '1', 1, 'IT202,IT301', 'Masters', 'Fictional record', 'Information Technology', '1'),
  (4, 'EMP-0004', 'E-1004', 'dfallowmere', 'Dacian', 'Lim', 'Fallowmere', 'Jr.', 'Engr.', '1990-01-30', 'M', '103 Sample Street, Testville', '555-0113', 'dfallowmere@staff.example.com', 'Instructor', '1', 1, 'IT203,IT302', 'Bachelors', 'Fictional record', 'Information Technology', '1'),
  (5, 'EMP-0005', 'E-1005', 'ppellingham', 'Perrin', 'Garcia', 'Pellingham', '', 'Ms.', '1992-05-17', 'F', '104 Sample Street, Testville', '555-0114', 'ppellingham@staff.example.com', 'Instructor', '1', 1, 'IT303', 'Bachelors', 'Fictional record', 'Information Technology', '1'),
  (6, 'EMP-0006', 'E-1006', 'ovantrell', 'Osric', 'Bautista', 'Vantrell', '', 'Mr.', '1975-09-08', 'M', '105 Sample Street, Testville', '555-0115', 'ovantrell@staff.example.com', 'Instructor', '1', 1, 'IT199', 'Bachelors', 'Fictional record', 'Information Technology', '0'),
  (7, 'EMP-0007', 'E-1007', 'csaltmarsh', 'Calla', 'Dizon', 'Saltmarsh', '', 'Ms.', '1986-12-02', 'F', '106 Sample Street, Testville', '555-0116', 'csaltmarsh@staff.example.com', 'Registrar Staff', '1', 0, '', 'Bachelors', 'Fictional record', 'Information Technology', '1');

-- Subjects: Type 1 = lecture, 2 = lecture+lab. IT199 (ID 10) is INACTIVE.
INSERT INTO `isms_dev`.`subjects_tbl` (`ID`, `Name`, `ShortCode`, `EducYearID`, `ProgramID`, `Units`, `Type`, `Status`, `ProgramCoordinatorID`, `DeptHeadID`) VALUES
  (1, 'Introduction to Computing', 'IT101', '1', 1, 3, 1, '1', 'EMP-0003', 'EMP-0001'),
  (2, 'Computer Programming 1', 'IT102', '1', 1, 3, 2, '1', 'EMP-0003', 'EMP-0001'),
  (3, 'Discrete Mathematics', 'IT103', '1', 1, 3, 1, '1', 'EMP-0003', 'EMP-0001'),
  (4, 'Data Structures and Algorithms', 'IT201', '2', 1, 3, 2, '1', 'EMP-0003', 'EMP-0001'),
  (5, 'Database Systems 1', 'IT202', '2', 1, 3, 2, '1', 'EMP-0003', 'EMP-0001'),
  (6, 'Web Development 1', 'IT203', '2', 1, 3, 2, '1', 'EMP-0003', 'EMP-0001'),
  (7, 'Networking Fundamentals', 'IT301', '3', 1, 3, 2, '1', 'EMP-0003', 'EMP-0001'),
  (8, 'Information Assurance and Security', 'IT302', '3', 1, 3, 1, '1', 'EMP-0003', 'EMP-0001'),
  (9, 'Systems Analysis and Design', 'IT303', '3', 1, 3, 1, '1', 'EMP-0003', 'EMP-0001'),
  (10, 'Legacy Office Productivity', 'IT199', '1', 1, 2, 2, '0', 'EMP-0003', 'EMP-0001');

-- Schedules: IDs 1-3 = current term (SYID 2, SemesterID 1), ID 4 = a past term for filter testing
INSERT INTO `isms_dev`.`schedules_tbl` (`ID`, `RefID`, `SYID`, `SemesterID`, `SectionID`, `AdviserID`, `Remarks`, `Status`, `CreateBy`, `CreateDate`) VALUES
  (1, 'SCH-2026-1-S1', 2, 1, 1, 'EMP-0001', 'BSIT 1-A, 1st Sem 2026-2027', '1', 'seed', '2026-06-15 08:00:00'),
  (2, 'SCH-2026-1-S2', 2, 1, 2, 'EMP-0002', 'BSIT 2-A, 1st Sem 2026-2027', '1', 'seed', '2026-06-15 08:00:00'),
  (3, 'SCH-2026-1-S3', 2, 1, 3, 'EMP-0004', 'BSIT 3-A, 1st Sem 2026-2027', '1', 'seed', '2026-06-15 08:00:00'),
  (4, 'SCH-2025-2-S1', 1, 2, 1, 'EMP-0001', 'BSIT 1-A, 2nd Sem 2025-2026 (past term)', '1', 'seed', '2025-11-20 08:00:00');

-- Schedule items: DayID codes M,T,W,TH,F,S combined (e.g. MW, TTH). Modality 1 = face-to-face, 2 = online. RoomID is a plain number (no rooms table in the stand-in).
INSERT INTO `isms_dev`.`scheduleitems_tbl` (`ID`, `RefID`, `SubjectID`, `InstructorID`, `RoomID`, `Modality`, `DayID`, `TimeFrom`, `TimeTo`, `Links`) VALUES
  (1, 'SCH-2026-1-S1', 1, 'EMP-0001', 101, 1, 'MW', '08:00:00', '09:30:00', NULL),
  (2, 'SCH-2026-1-S1', 2, 'EMP-0001', 201, 1, 'TTH', '08:00:00', '09:30:00', NULL),
  (3, 'SCH-2026-1-S1', 3, 'EMP-0002', 102, 1, 'MW', '10:00:00', '11:30:00', NULL),
  (4, 'SCH-2026-1-S2', 4, 'EMP-0002', 202, 1, 'MW', '13:00:00', '14:30:00', NULL),
  (5, 'SCH-2026-1-S2', 5, 'EMP-0003', 203, 1, 'TTH', '10:00:00', '11:30:00', NULL),
  (6, 'SCH-2026-1-S2', 6, 'EMP-0004', 204, 2, 'F', '08:00:00', '11:00:00', 'https://meet.example.com/it203-2a'),
  (7, 'SCH-2026-1-S3', 7, 'EMP-0003', 205, 1, 'MW', '15:00:00', '16:30:00', NULL),
  (8, 'SCH-2026-1-S3', 8, 'EMP-0004', 103, 1, 'TTH', '13:00:00', '14:30:00', NULL),
  (9, 'SCH-2026-1-S3', 9, 'EMP-0005', 104, 1, 'TTH', '15:00:00', '16:30:00', NULL),
  (10, 'SCH-2025-2-S1', 10, 'EMP-0006', 101, 1, 'S', '08:00:00', '11:00:00', NULL),
  (11, 'SCH-2025-2-S1', 3, 'EMP-0002', 102, 1, 'MW', '08:00:00', '09:30:00', NULL);

-- Students: STU-0001..0010 -> BSIT 1-A, STU-0011..0020 -> BSIT 2-A, STU-0021..0030 -> BSIT 3-A
INSERT INTO `isms_dev`.`students_tbl` (`ID`, `RefID`, `StudentID`, `LRN`, `TESDAID`, `FName`, `MName`, `LName`, `Suffix`, `BDate`, `BPlace`, `Email`, `Password`, `TempPassword`, `CPNo`, `LandLineNo`, `CivilStatus`, `Sex`, `Religion`, `Address`, `MotherName`, `MotherOccupation`, `MotherContactNo`, `FatherName`, `FatherOccupation`, `FatherContactNo`, `GuardianID`, `GuardianName`, `GuardianRelation`, `GuardianContactNo`, `Remarks`, `BranchID`, `OnlineAccess`, `Status`, `CreateBy`, `CreateDate`) VALUES
  (1, 'STU-0001', '2026-0001', NULL, NULL, 'Aren', 'Reyes', 'Brightwater', NULL, '2007-01-01', 'Testville', 'stu0001@students.example.com', NULL, NULL, '555-0201', NULL, 'Single', 'F', NULL, '1 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Aren', 'Parent', '555-0301', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (2, 'STU-0002', '2026-0002', NULL, NULL, 'Bexley', 'Santos', 'Copperfield', NULL, '2007-02-02', 'Testville', 'stu0002@students.example.com', NULL, NULL, '555-0202', NULL, 'Single', 'M', NULL, '2 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Bexley', 'Parent', '555-0302', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (3, 'STU-0003', '2026-0003', NULL, NULL, 'Corin', 'Cruz', 'Duskmoor', NULL, '2007-03-03', 'Testville', 'stu0003@students.example.com', NULL, NULL, '555-0203', NULL, 'Single', 'F', NULL, '3 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Corin', 'Parent', '555-0303', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (4, 'STU-0004', '2026-0004', NULL, NULL, 'Daelyn', 'Lopez', 'Elderbrook', NULL, '2007-04-04', 'Testville', 'stu0004@students.example.com', NULL, NULL, '555-0204', NULL, 'Single', 'M', NULL, '4 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Daelyn', 'Parent', '555-0304', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (5, 'STU-0005', '2026-0005', NULL, NULL, 'Ember', 'Ramos', 'Fernhollow', NULL, '2007-05-05', 'Testville', 'stu0005@students.example.com', NULL, NULL, '555-0205', NULL, 'Single', 'F', NULL, '5 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Ember', 'Parent', '555-0305', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (6, 'STU-0006', '2026-0006', NULL, NULL, 'Faro', 'Torres', 'Glimmerton', NULL, '2007-06-06', 'Testville', 'stu0006@students.example.com', NULL, NULL, '555-0206', NULL, 'Single', 'M', NULL, '6 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Faro', 'Parent', '555-0306', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (7, 'STU-0007', '2026-0007', NULL, NULL, 'Galen', 'Reyes', 'Hartwell', NULL, '2007-07-07', 'Testville', 'stu0007@students.example.com', NULL, NULL, '555-0207', NULL, 'Single', 'F', NULL, '7 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Galen', 'Parent', '555-0307', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (8, 'STU-0008', '2026-0008', NULL, NULL, 'Hollis', 'Santos', 'Ivoryglen', NULL, '2007-08-08', 'Testville', 'stu0008@students.example.com', NULL, NULL, '555-0208', NULL, 'Single', 'M', NULL, '8 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Hollis', 'Parent', '555-0308', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (9, 'STU-0009', '2026-0009', NULL, NULL, 'Isadora', 'Cruz', 'Juniperly', NULL, '2007-09-09', 'Testville', 'stu0009@students.example.com', NULL, NULL, '555-0209', NULL, 'Single', 'F', NULL, '9 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Isadora', 'Parent', '555-0309', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (10, 'STU-0010', '2026-0010', NULL, NULL, 'Jaxen', 'Lopez', 'Kettleby', NULL, '2007-10-10', 'Testville', 'stu0010@students.example.com', NULL, NULL, '555-0210', NULL, 'Single', 'M', NULL, '10 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Jaxen', 'Parent', '555-0310', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (11, 'STU-0011', '2026-0011', NULL, NULL, 'Kestrel', 'Ramos', 'Larkspur', NULL, '2006-11-11', 'Testville', 'stu0011@students.example.com', NULL, NULL, '555-0211', NULL, 'Single', 'F', NULL, '11 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Kestrel', 'Parent', '555-0311', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (12, 'STU-0012', '2026-0012', NULL, NULL, 'Lumi', 'Torres', 'Mistvale', NULL, '2006-12-12', 'Testville', 'stu0012@students.example.com', NULL, NULL, '555-0212', NULL, 'Single', 'M', NULL, '12 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Lumi', 'Parent', '555-0312', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (13, 'STU-0013', '2026-0013', NULL, NULL, 'Marlo', 'Reyes', 'Northam', NULL, '2006-01-13', 'Testville', 'stu0013@students.example.com', NULL, NULL, '555-0213', NULL, 'Single', 'F', NULL, '13 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Marlo', 'Parent', '555-0313', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (14, 'STU-0014', '2026-0014', NULL, NULL, 'Nyra', 'Santos', 'Oakhurst', NULL, '2006-02-14', 'Testville', 'stu0014@students.example.com', NULL, NULL, '555-0214', NULL, 'Single', 'M', NULL, '14 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Nyra', 'Parent', '555-0314', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (15, 'STU-0015', '2026-0015', NULL, NULL, 'Orrin', 'Cruz', 'Pinecrest', NULL, '2006-03-15', 'Testville', 'stu0015@students.example.com', NULL, NULL, '555-0215', NULL, 'Single', 'F', NULL, '15 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Orrin', 'Parent', '555-0315', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (16, 'STU-0016', '2026-0016', NULL, NULL, 'Pella', 'Lopez', 'Quarrybrook', NULL, '2006-04-16', 'Testville', 'stu0016@students.example.com', NULL, NULL, '555-0216', NULL, 'Single', 'M', NULL, '16 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Pella', 'Parent', '555-0316', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (17, 'STU-0017', '2026-0017', NULL, NULL, 'Quill', 'Ramos', 'Ravensby', NULL, '2006-05-17', 'Testville', 'stu0017@students.example.com', NULL, NULL, '555-0217', NULL, 'Single', 'F', NULL, '17 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Quill', 'Parent', '555-0317', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (18, 'STU-0018', '2026-0018', NULL, NULL, 'Rowan', 'Torres', 'Stonebridge', NULL, '2006-06-18', 'Testville', 'stu0018@students.example.com', NULL, NULL, '555-0218', NULL, 'Single', 'M', NULL, '18 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Rowan', 'Parent', '555-0318', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (19, 'STU-0019', '2026-0019', NULL, NULL, 'Sable', 'Reyes', 'Thistlewood', NULL, '2006-07-19', 'Testville', 'stu0019@students.example.com', NULL, NULL, '555-0219', NULL, 'Single', 'F', NULL, '19 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Sable', 'Parent', '555-0319', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (20, 'STU-0020', '2026-0020', NULL, NULL, 'Tamsin', 'Santos', 'Underhill', NULL, '2006-08-20', 'Testville', 'stu0020@students.example.com', NULL, NULL, '555-0220', NULL, 'Single', 'M', NULL, '20 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Tamsin', 'Parent', '555-0320', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (21, 'STU-0021', '2026-0021', NULL, NULL, 'Ulric', 'Cruz', 'Valemont', NULL, '2005-09-21', 'Testville', 'stu0021@students.example.com', NULL, NULL, '555-0221', NULL, 'Single', 'F', NULL, '21 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Ulric', 'Parent', '555-0321', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (22, 'STU-0022', '2026-0022', NULL, NULL, 'Vesna', 'Lopez', 'Willowmere', NULL, '2005-10-22', 'Testville', 'stu0022@students.example.com', NULL, NULL, '555-0222', NULL, 'Single', 'M', NULL, '22 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Vesna', 'Parent', '555-0322', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (23, 'STU-0023', '2026-0023', NULL, NULL, 'Wren', 'Ramos', 'Yarrowfield', NULL, '2005-11-23', 'Testville', 'stu0023@students.example.com', NULL, NULL, '555-0223', NULL, 'Single', 'F', NULL, '23 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Wren', 'Parent', '555-0323', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (24, 'STU-0024', '2026-0024', NULL, NULL, 'Xander', 'Torres', 'Zinnberg', NULL, '2005-12-24', 'Testville', 'stu0024@students.example.com', NULL, NULL, '555-0224', NULL, 'Single', 'M', NULL, '24 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Xander', 'Parent', '555-0324', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (25, 'STU-0025', '2026-0025', NULL, NULL, 'Yara', 'Reyes', 'Ashdown', NULL, '2005-01-25', 'Testville', 'stu0025@students.example.com', NULL, NULL, '555-0225', NULL, 'Single', 'F', NULL, '25 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Yara', 'Parent', '555-0325', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (26, 'STU-0026', '2026-0026', NULL, NULL, 'Zephyr', 'Santos', 'Bramblecote', NULL, '2005-02-26', 'Testville', 'stu0026@students.example.com', NULL, NULL, '555-0226', NULL, 'Single', 'M', NULL, '26 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Zephyr', 'Parent', '555-0326', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (27, 'STU-0027', '2026-0027', NULL, NULL, 'Ansel', 'Cruz', 'Cindervale', NULL, '2005-03-27', 'Testville', 'stu0027@students.example.com', NULL, NULL, '555-0227', NULL, 'Single', 'F', NULL, '27 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Ansel', 'Parent', '555-0327', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (28, 'STU-0028', '2026-0028', NULL, NULL, 'Brisa', 'Lopez', 'Dovecote', NULL, '2005-04-01', 'Testville', 'stu0028@students.example.com', NULL, NULL, '555-0228', NULL, 'Single', 'M', NULL, '28 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Brisa', 'Parent', '555-0328', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (29, 'STU-0029', '2026-0029', NULL, NULL, 'Caspian', 'Ramos', 'Emberlyn', NULL, '2005-05-02', 'Testville', 'stu0029@students.example.com', NULL, NULL, '555-0229', NULL, 'Single', 'F', NULL, '29 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Caspian', 'Parent', '555-0329', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00'),
  (30, 'STU-0030', '2026-0030', NULL, NULL, 'Delphine', 'Torres', 'Foxglade', NULL, '2005-06-03', 'Testville', 'stu0030@students.example.com', NULL, NULL, '555-0230', NULL, 'Single', 'M', NULL, '30 Placeholder Avenue, Testville', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Guardian of Delphine', 'Parent', '555-0330', 'Fictional seed record', '1', '0', '1', 'seed', '2026-06-01 09:00:00');

-- Enrollments: StudentID holds the student RefID. Status '1' = enrolled.
-- ENR-2026-1-xxxx = current term (SYID 2, SemesterID 1); ENR-2025-2-0011..0015 = past term (SYID 1, SemesterID 2).
INSERT INTO `isms_dev`.`enrollments_tbl` (`ID`, `RefID`, `StudentID`, `EntryID`, `Admission`, `Modality`, `SYID`, `SemesterID`, `BranchID`, `EducYearID`, `ProgramID`, `TuitionTempID`, `SectionID`, `PreviousEnrollmentRef`, `StudentStatus`, `GradeSchoolName`, `GradeSchoolYearGraduated`, `HighSchoolName`, `HighSchoolYearGraduated`, `SeniorHighSchoolName`, `SeniorHighSchoolYearGraduated`, `CollegeName`, `CollegeCourse`, `CollegeSchoolYear`, `Remarks`, `TuitionAmount`, `CashDiscount`, `TType`, `TAmount`, `Status`, `IsHistorical`, `CreateBy`, `CreateDate`) VALUES
  (1, 'ENR-2026-1-0001', 'STU-0001', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (2, 'ENR-2026-1-0002', 'STU-0002', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (3, 'ENR-2026-1-0003', 'STU-0003', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (4, 'ENR-2026-1-0004', 'STU-0004', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (5, 'ENR-2026-1-0005', 'STU-0005', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (6, 'ENR-2026-1-0006', 'STU-0006', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (7, 'ENR-2026-1-0007', 'STU-0007', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (8, 'ENR-2026-1-0008', 'STU-0008', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (9, 'ENR-2026-1-0009', 'STU-0009', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (10, 'ENR-2026-1-0010', 'STU-0010', '1', '1', '1', 2, 1, 1, 1, 1, 'TT-2026-1', '1', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', '2026', NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (11, 'ENR-2026-1-0011', 'STU-0011', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (12, 'ENR-2026-1-0012', 'STU-0012', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (13, 'ENR-2026-1-0013', 'STU-0013', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (14, 'ENR-2026-1-0014', 'STU-0014', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (15, 'ENR-2026-1-0015', 'STU-0015', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (16, 'ENR-2026-1-0016', 'STU-0016', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (17, 'ENR-2026-1-0017', 'STU-0017', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (18, 'ENR-2026-1-0018', 'STU-0018', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (19, 'ENR-2026-1-0019', 'STU-0019', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (20, 'ENR-2026-1-0020', 'STU-0020', '1', '0', '1', 2, 1, 1, 2, 1, 'TT-2026-1', '2', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (21, 'ENR-2026-1-0021', 'STU-0021', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (22, 'ENR-2026-1-0022', 'STU-0022', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (23, 'ENR-2026-1-0023', 'STU-0023', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (24, 'ENR-2026-1-0024', 'STU-0024', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (25, 'ENR-2026-1-0025', 'STU-0025', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (26, 'ENR-2026-1-0026', 'STU-0026', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (27, 'ENR-2026-1-0027', 'STU-0027', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (28, 'ENR-2026-1-0028', 'STU-0028', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (29, 'ENR-2026-1-0029', 'STU-0029', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (30, 'ENR-2026-1-0030', 'STU-0030', '1', '0', '1', 2, 1, 1, 3, 1, 'TT-2026-1', '3', NULL, 'R', NULL, NULL, NULL, NULL, 'Sample Senior High (fictional)', NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 0, 'seed', '2026-06-15 09:00:00'),
  (31, 'ENR-2025-2-0011', 'STU-0011', '1', NULL, '1', 1, 2, 1, 1, 1, 'TT-2025-2', '1', NULL, 'R', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 1, 'seed', '2025-11-20 09:00:00'),
  (32, 'ENR-2025-2-0012', 'STU-0012', '1', NULL, '1', 1, 2, 1, 1, 1, 'TT-2025-2', '1', NULL, 'R', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 1, 'seed', '2025-11-20 09:00:00'),
  (33, 'ENR-2025-2-0013', 'STU-0013', '1', NULL, '1', 1, 2, 1, 1, 1, 'TT-2025-2', '1', NULL, 'R', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 1, 'seed', '2025-11-20 09:00:00'),
  (34, 'ENR-2025-2-0014', 'STU-0014', '1', NULL, '1', 1, 2, 1, 1, 1, 'TT-2025-2', '1', NULL, 'R', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 1, 'seed', '2025-11-20 09:00:00'),
  (35, 'ENR-2025-2-0015', 'STU-0015', '1', NULL, '1', 1, 2, 1, 1, 1, 'TT-2025-2', '1', NULL, 'R', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, '1', 0, '1', 1, 'seed', '2025-11-20 09:00:00');

-- Section membership
INSERT INTO `isms_dev`.`educsectionsitems_tbl` (`ID`, `SectionID`, `EnrollID`) VALUES
  (1, '1', 'ENR-2026-1-0001'),
  (2, '1', 'ENR-2026-1-0002'),
  (3, '1', 'ENR-2026-1-0003'),
  (4, '1', 'ENR-2026-1-0004'),
  (5, '1', 'ENR-2026-1-0005'),
  (6, '1', 'ENR-2026-1-0006'),
  (7, '1', 'ENR-2026-1-0007'),
  (8, '1', 'ENR-2026-1-0008'),
  (9, '1', 'ENR-2026-1-0009'),
  (10, '1', 'ENR-2026-1-0010'),
  (11, '2', 'ENR-2026-1-0011'),
  (12, '2', 'ENR-2026-1-0012'),
  (13, '2', 'ENR-2026-1-0013'),
  (14, '2', 'ENR-2026-1-0014'),
  (15, '2', 'ENR-2026-1-0015'),
  (16, '2', 'ENR-2026-1-0016'),
  (17, '2', 'ENR-2026-1-0017'),
  (18, '2', 'ENR-2026-1-0018'),
  (19, '2', 'ENR-2026-1-0019'),
  (20, '2', 'ENR-2026-1-0020'),
  (21, '3', 'ENR-2026-1-0021'),
  (22, '3', 'ENR-2026-1-0022'),
  (23, '3', 'ENR-2026-1-0023'),
  (24, '3', 'ENR-2026-1-0024'),
  (25, '3', 'ENR-2026-1-0025'),
  (26, '3', 'ENR-2026-1-0026'),
  (27, '3', 'ENR-2026-1-0027'),
  (28, '3', 'ENR-2026-1-0028'),
  (29, '3', 'ENR-2026-1-0029'),
  (30, '3', 'ENR-2026-1-0030'),
  (31, '1', 'ENR-2025-2-0011'),
  (32, '1', 'ENR-2025-2-0012'),
  (33, '1', 'ENR-2025-2-0013'),
  (34, '1', 'ENR-2025-2-0014'),
  (35, '1', 'ENR-2025-2-0015');

-- Students attached to schedules (RefID = schedule RefID, EnrollmentID = enrollment RefID)
INSERT INTO `isms_dev`.`schedulestudents_tbl` (`ID`, `RefID`, `EnrollmentID`) VALUES
  (1, 'SCH-2026-1-S1', 'ENR-2026-1-0001'),
  (2, 'SCH-2026-1-S1', 'ENR-2026-1-0002'),
  (3, 'SCH-2026-1-S1', 'ENR-2026-1-0003'),
  (4, 'SCH-2026-1-S1', 'ENR-2026-1-0004'),
  (5, 'SCH-2026-1-S1', 'ENR-2026-1-0005'),
  (6, 'SCH-2026-1-S1', 'ENR-2026-1-0006'),
  (7, 'SCH-2026-1-S1', 'ENR-2026-1-0007'),
  (8, 'SCH-2026-1-S1', 'ENR-2026-1-0008'),
  (9, 'SCH-2026-1-S1', 'ENR-2026-1-0009'),
  (10, 'SCH-2026-1-S1', 'ENR-2026-1-0010'),
  (11, 'SCH-2026-1-S2', 'ENR-2026-1-0011'),
  (12, 'SCH-2026-1-S2', 'ENR-2026-1-0012'),
  (13, 'SCH-2026-1-S2', 'ENR-2026-1-0013'),
  (14, 'SCH-2026-1-S2', 'ENR-2026-1-0014'),
  (15, 'SCH-2026-1-S2', 'ENR-2026-1-0015'),
  (16, 'SCH-2026-1-S2', 'ENR-2026-1-0016'),
  (17, 'SCH-2026-1-S2', 'ENR-2026-1-0017'),
  (18, 'SCH-2026-1-S2', 'ENR-2026-1-0018'),
  (19, 'SCH-2026-1-S2', 'ENR-2026-1-0019'),
  (20, 'SCH-2026-1-S2', 'ENR-2026-1-0020'),
  (21, 'SCH-2026-1-S3', 'ENR-2026-1-0021'),
  (22, 'SCH-2026-1-S3', 'ENR-2026-1-0022'),
  (23, 'SCH-2026-1-S3', 'ENR-2026-1-0023'),
  (24, 'SCH-2026-1-S3', 'ENR-2026-1-0024'),
  (25, 'SCH-2026-1-S3', 'ENR-2026-1-0025'),
  (26, 'SCH-2026-1-S3', 'ENR-2026-1-0026'),
  (27, 'SCH-2026-1-S3', 'ENR-2026-1-0027'),
  (28, 'SCH-2026-1-S3', 'ENR-2026-1-0028'),
  (29, 'SCH-2026-1-S3', 'ENR-2026-1-0029'),
  (30, 'SCH-2026-1-S3', 'ENR-2026-1-0030'),
  (31, 'SCH-2025-2-S1', 'ENR-2025-2-0011'),
  (32, 'SCH-2025-2-S1', 'ENR-2025-2-0012'),
  (33, 'SCH-2025-2-S1', 'ENR-2025-2-0013'),
  (34, 'SCH-2025-2-S1', 'ENR-2025-2-0014'),
  (35, 'SCH-2025-2-S1', 'ENR-2025-2-0015');
