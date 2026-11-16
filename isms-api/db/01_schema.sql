-- =============================================================================
-- ISMS stand-in schema (DEVELOPMENT ONLY)
--
-- Recreates the subset of the ISMS `tmccdb` tables that the read-only ISMS API
-- reads: subjects, employees, school years, semesters, sections, schedules,
-- schedule items, schedule students, enrollments and students.
--
-- Table and column names, types, lengths, defaults and indexes follow the EF
-- Core fluent mappings in ISMSdbContext.cs exactly (including casing). Columns
-- with no explicit mapping use the C# property name; C# nullability decides
-- NULL / NOT NULL.
--
-- Safety: this script only ever touches the `isms_dev` database. It is named
-- differently from the real `tmccdb` on purpose so a real local copy can never
-- be dropped by running this file.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `isms_dev`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `isms_dev`;

-- Every DROP / CREATE below is fully qualified with `isms_dev`, so nothing
-- outside that database can be affected even if the USE above is changed.
DROP TABLE IF EXISTS `isms_dev`.`schedulestudents_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`scheduleitems_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`schedules_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`educsectionsitems_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`enrollments_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`students_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`educsections_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`semester_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`schoolyear_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`employees_tbl`;
DROP TABLE IF EXISTS `isms_dev`.`subjects_tbl`;

-- SubjectEntity
CREATE TABLE `isms_dev`.`subjects_tbl` (
  `ID`                   INT          NOT NULL AUTO_INCREMENT,
  `Name`                 VARCHAR(120) NOT NULL,
  `ShortCode`            VARCHAR(12)  NULL,
  `EducYearID`           VARCHAR(45)  NULL,
  `ProgramID`            INT          NULL,
  `Units`                INT          NOT NULL DEFAULT '1',
  `Type`                 INT          NOT NULL,
  `Status`               CHAR(1)      NOT NULL DEFAULT '1',
  `ProgramCoordinatorID` VARCHAR(45)  NULL,
  `DeptHeadID`           VARCHAR(45)  NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name_UNIQUE` (`Name`),
  UNIQUE KEY `ShortCode_UNIQUE` (`ShortCode`),
  UNIQUE KEY `UniqueIndex` (`Name`, `EducYearID`, `ProgramID`),
  KEY `IndexList` (`EducYearID`, `ProgramID`)
) ENGINE=InnoDB;

-- EmployeesEntity
CREATE TABLE `isms_dev`.`employees_tbl` (
  `ID`               INT          NOT NULL AUTO_INCREMENT,
  `RefID`            VARCHAR(45)  NOT NULL,
  `EmpNo`            VARCHAR(45)  NULL,
  `UserName`         VARCHAR(45)  NULL,
  `FName`            VARCHAR(45)  NOT NULL,
  `MName`            VARCHAR(45)  NOT NULL,
  `LName`            VARCHAR(45)  NOT NULL,
  `Suffix`           VARCHAR(45)  NOT NULL,
  `Honorific`        VARCHAR(45)  NOT NULL,
  `BDate`            DATE         NOT NULL,
  `Sex`              CHAR(1)      NOT NULL,
  `Address`          VARCHAR(200) NOT NULL,
  `ContactNo`        VARCHAR(45)  NOT NULL,
  `Email`            VARCHAR(45)  NOT NULL,
  `Position`         VARCHAR(45)  NOT NULL,
  `DepartmentID`     VARCHAR(45)  NOT NULL,
  `IsGradesEditor`   TINYINT(1)   NULL DEFAULT '0',
  `SubjectsHandled`  LONGTEXT     NOT NULL,
  `EducationLevel`   VARCHAR(20)  NULL,
  `EducationRemarks` VARCHAR(120) NULL,
  `Course`           VARCHAR(120) NULL,
  `Status`           CHAR(1)      NOT NULL DEFAULT '1',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `EmpNo_UNIQUE` (`EmpNo`),
  UNIQUE KEY `RefID_UNIQUE` (`RefID`),
  UNIQUE KEY `UnniqueIndex` (`FName`, `LName`, `BDate`),
  UNIQUE KEY `UserName_UNIQUE` (`UserName`)
) ENGINE=InnoDB;

-- SchoolyearTbl
CREATE TABLE `isms_dev`.`schoolyear_tbl` (
  `ID`       INT     NOT NULL AUTO_INCREMENT,
  `SYFrom`   INT     NOT NULL,
  `SYTo`     INT     NOT NULL,
  `Standing` CHAR(1) NOT NULL DEFAULT '0',
  `Status`   CHAR(2) NOT NULL DEFAULT '1',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `SYTo_UNIQUE` (`SYTo`),
  UNIQUE KEY `SchoolYear_UNIQUE` (`SYFrom`)
) ENGINE=InnoDB;

-- SemesterEntity
CREATE TABLE `isms_dev`.`semester_tbl` (
  `ID`         INT         NOT NULL AUTO_INCREMENT,
  `Name`       VARCHAR(45) NOT NULL,
  `StandingID` CHAR(1)     NOT NULL DEFAULT '0',
  `Status`     CHAR(1)     NOT NULL DEFAULT '1',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB;

-- EducsectionsTbl
CREATE TABLE `isms_dev`.`educsections_tbl` (
  `ID`          INT          NOT NULL AUTO_INCREMENT,
  `BranchID`    VARCHAR(45)  NOT NULL,
  `YearID`      VARCHAR(45)  NOT NULL,
  `ProgramID`   VARCHAR(45)  NULL,
  `Name`        VARCHAR(45)  NOT NULL,
  `MaxCapacity` INT          NOT NULL,
  `Remarks`     VARCHAR(200) NOT NULL,
  `Status`      CHAR(1)      NOT NULL DEFAULT '1',
  PRIMARY KEY (`ID`),
  KEY `IndexList` (`BranchID`, `YearID`, `ProgramID`)
) ENGINE=InnoDB;

-- EducsectionsitemsTbl (section membership: which enrollment is in which section)
CREATE TABLE `isms_dev`.`educsectionsitems_tbl` (
  `ID`        INT         NOT NULL AUTO_INCREMENT,
  `SectionID` VARCHAR(45) NOT NULL,
  `EnrollID`  VARCHAR(45) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB;

-- StudentEntity
CREATE TABLE `isms_dev`.`students_tbl` (
  `ID`                INT          NOT NULL AUTO_INCREMENT,
  `RefID`             VARCHAR(45)  NOT NULL,
  `StudentID`         VARCHAR(45)  NULL,
  `LRN`               VARCHAR(45)  NULL,
  `TESDAID`           VARCHAR(45)  NULL,
  `FName`             VARCHAR(45)  NOT NULL,
  `MName`             VARCHAR(45)  NULL,
  `LName`             VARCHAR(45)  NOT NULL,
  `Suffix`            VARCHAR(45)  NULL,
  `BDate`             DATE         NULL,
  `BPlace`            VARCHAR(120) NULL,
  `Email`             VARCHAR(45)  NULL,
  `Password`          VARCHAR(45)  NULL,
  `TempPassword`      VARCHAR(45)  NULL,
  `CPNo`              VARCHAR(45)  NULL,
  `LandLineNo`        VARCHAR(45)  NULL,
  `CivilStatus`       VARCHAR(45)  NULL,
  `Sex`               VARCHAR(45)  NULL,
  `Religion`          VARCHAR(45)  NULL,
  `Address`           VARCHAR(200) NULL,
  `MotherName`        VARCHAR(120) NULL,
  `MotherOccupation`  VARCHAR(60)  NULL,
  `MotherContactNo`   VARCHAR(45)  NULL,
  `FatherName`        VARCHAR(120) NULL,
  `FatherOccupation`  VARCHAR(60)  NULL,
  `FatherContactNo`   VARCHAR(45)  NULL,
  `GuardianID`        VARCHAR(45)  NULL,
  `GuardianName`      VARCHAR(120) NULL,
  `GuardianRelation`  VARCHAR(45)  NULL,
  `GuardianContactNo` VARCHAR(45)  NULL,
  `Remarks`           VARCHAR(240) NULL,
  `BranchID`          VARCHAR(45)  NULL,
  `OnlineAccess`      CHAR(1)      NOT NULL DEFAULT '0',
  `Status`            CHAR(1)      NOT NULL DEFAULT '1',
  `CreateBy`          VARCHAR(45)  NOT NULL,
  `CreateDate`        DATETIME     NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Email_UNIQUE` (`Email`),
  UNIQUE KEY `RefID_UNIQUE` (`RefID`),
  UNIQUE KEY `UniqueIndex` (`FName`, `LName`, `BDate`),
  KEY `IndexList` (`GuardianID`)
) ENGINE=InnoDB;

-- EnrollmentsTbl
CREATE TABLE `isms_dev`.`enrollments_tbl` (
  `ID`                            INT           NOT NULL AUTO_INCREMENT,
  `RefID`                         VARCHAR(45)   NOT NULL,
  `StudentID`                     VARCHAR(45)   NOT NULL,
  `EntryID`                       CHAR(1)       NOT NULL,
  `Admission`                     CHAR(1)       NULL,
  `Modality`                      CHAR(1)       NOT NULL,
  `SYID`                          INT           NOT NULL,
  `SemesterID`                    INT           NOT NULL,
  `BranchID`                      INT           NOT NULL,
  `EducYearID`                    INT           NOT NULL,
  `ProgramID`                     INT           NOT NULL,
  `TuitionTempID`                 VARCHAR(12)   NOT NULL,
  `SectionID`                     VARCHAR(100)  NOT NULL,
  `PreviousEnrollmentRef`         VARCHAR(50)   NULL,
  `StudentStatus`                 CHAR(2)       NULL,
  `GradeSchoolName`               VARCHAR(155)  NULL,
  `GradeSchoolYearGraduated`      VARCHAR(45)   NULL,
  `HighSchoolName`                VARCHAR(155)  NULL,
  `HighSchoolYearGraduated`       VARCHAR(45)   NULL,
  `SeniorHighSchoolName`          VARCHAR(155)  NULL,
  `SeniorHighSchoolYearGraduated` VARCHAR(45)   NULL,
  `CollegeName`                   VARCHAR(155)  NULL,
  `CollegeCourse`                 VARCHAR(155)  NULL,
  `CollegeSchoolYear`             VARCHAR(45)   NULL,
  `Remarks`                       VARCHAR(200)  NULL,
  `TuitionAmount`                 DECIMAL(20,0) NOT NULL,
  `CashDiscount`                  DECIMAL(20,0) NULL,
  `TType`                         CHAR(1)       NOT NULL,
  `TAmount`                       DECIMAL(20,0) NOT NULL,
  `Status`                        CHAR(1)       NOT NULL DEFAULT '0',
  `IsHistorical`                  TINYINT(1)    NULL DEFAULT '0',
  `CreateBy`                      VARCHAR(45)   NOT NULL,
  `CreateDate`                    DATETIME      NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `RefID_UNIQUE` (`RefID`),
  UNIQUE KEY `UniqueIndex` (`StudentID`, `SYID`, `SemesterID`, `Status`, `SectionID`, `StudentStatus`),
  KEY `IndexList` (`StudentID`, `SYID`, `SemesterID`, `BranchID`, `EducYearID`, `ProgramID`, `CreateBy`)
) ENGINE=InnoDB;

-- SchedulesTbl
CREATE TABLE `isms_dev`.`schedules_tbl` (
  `ID`         INT          NOT NULL AUTO_INCREMENT,
  `RefID`      VARCHAR(45)  NOT NULL,
  `SYID`       INT          NOT NULL,
  `SemesterID` INT          NOT NULL,
  `SectionID`  INT          NOT NULL,
  `AdviserID`  VARCHAR(45)  NOT NULL,
  `Remarks`    VARCHAR(120) NOT NULL,
  `Status`     CHAR(1)      NOT NULL DEFAULT '1',
  `CreateBy`   VARCHAR(45)  NOT NULL,
  `CreateDate` DATETIME     NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `RefID_UNIQUE` (`RefID`),
  KEY `IndexList` (`SYID`, `SectionID`, `CreateBy`)
) ENGINE=InnoDB;

-- ScheduleitemsTbl
CREATE TABLE `isms_dev`.`scheduleitems_tbl` (
  `ID`           INT          NOT NULL AUTO_INCREMENT,
  `RefID`        VARCHAR(45)  NOT NULL,
  `SubjectID`    INT          NOT NULL,
  `InstructorID` VARCHAR(45)  NOT NULL,
  `RoomID`       INT          NOT NULL,
  `Modality`     INT          NOT NULL,
  `DayID`        VARCHAR(45)  NOT NULL,
  `TimeFrom`     TIME         NOT NULL,
  `TimeTo`       TIME         NOT NULL,
  `Links`        VARCHAR(450) NULL,
  PRIMARY KEY (`ID`),
  KEY `IndexList` (`RefID`, `SubjectID`, `InstructorID`, `RoomID`)
) ENGINE=InnoDB;

-- SchedulestudentsTbl
CREATE TABLE `isms_dev`.`schedulestudents_tbl` (
  `ID`           INT         NOT NULL AUTO_INCREMENT,
  `RefID`        VARCHAR(45) NOT NULL,
  `EnrollmentID` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `IndexList` (`RefID`, `EnrollmentID`)
) ENGINE=InnoDB;
