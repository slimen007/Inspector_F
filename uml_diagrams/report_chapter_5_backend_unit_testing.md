# Chapter 5: Backend Unit Testing with JUnit 5 and Mockito

## 5.1 Introduction

Quality assurance is a core requirement for the Inspector Platform because the backend service layer contains the business rules that drive authentication, scheduling, quiz generation, administration, and auditability. A defect in this layer can directly affect data integrity, access control, and pedagogical workflows.

This chapter presents the unit testing strategy implemented for the Spring Boot backend using **JUnit 5** and **Mockito**. The test suite targets the service layer in isolation, without any real database, mail server, or external AI call. At the time of verification, the backend test suite contains **15 unit tests** distributed across **6 service implementation classes**, and the full Maven run completed successfully with **0 failures**, **0 errors**, and **0 skipped tests**.

The generated test reports are available in [backend/target/surefire-reports](C:/Users/SPIRIT/Desktop/pfe/inspector__7/inspector/backend/target/surefire-reports).

## 5.2 Testing Strategy and Objectives

### 5.2.1 Testing Philosophy

The adopted approach follows the **unit testing paradigm**, where each service method is validated independently from its collaborators. All external dependencies such as repositories, authentication components, notification services, and AI integrations are replaced with Mockito mocks. This ensures that every test focuses only on the business logic of the class under test.

The strategy provides the following guarantees:

| Objective | Validation Mechanism |
| :--- | :--- |
| **Correctness** | Assertions on returned DTOs, tokens, lists, and state transitions |
| **Robustness** | Validation of both nominal scenarios and exception paths |
| **Isolation** | Full dependency mocking with Mockito |
| **Repeatability** | No dependency on a running database, SMTP server, or external API |
| **Maintainability** | Small, focused tests mapped directly to service responsibilities |

### 5.2.2 Scope of Testing

The test suite focuses on the **Service Layer**, which contains the business rules of the application.

| Service Class | Main Responsibility |
| :--- | :--- |
| `AuthServiceImpl` | Registration, login, and JWT-based authentication |
| `ActivityServiceImpl` | Activity creation and scheduling validation |
| `QuizServiceImpl` | AI-based quiz question generation and parsing |
| `UserServiceImpl` | User retrieval and account deletion |
| `AdminServiceImpl` | Administrative access to users and geographical data |
| `AuditServiceImpl` | Action log creation and user history retrieval |

## 5.3 Tools and Technologies

### 5.3.1 JUnit 5

**JUnit 5 (Jupiter)** was used as the primary test framework. The main features used in the test classes are:

- `@Test` to define test methods.
- `@ExtendWith(MockitoExtension.class)` to integrate Mockito into the JUnit lifecycle.
- `assertNotNull()`, `assertEquals()`, and `assertTrue()` for result verification.
- `assertThrows()` to verify expected exceptions.

### 5.3.2 Mockito

**Mockito** was used to isolate dependencies and control collaborator behavior.

| Annotation / Method | Purpose |
| :--- | :--- |
| `@Mock` | Creates mock dependencies |
| `@InjectMocks` | Instantiates the service under test and injects mocks |
| `when(...).thenReturn(...)` | Defines a controlled response |
| `when(...).thenThrow(...)` | Simulates failure scenarios |
| `verify(...)` | Verifies interactions with dependencies |
| `any()`, `anyString()`, `anyLong()` | Provides flexible argument matching |

### 5.3.3 Maven Surefire Plugin

Test execution is handled by the **Maven Surefire Plugin**, which discovers the JUnit 5 test classes automatically and writes detailed `.txt` and `.xml` reports into `backend/target/surefire-reports/`.

The validated command used during this report preparation was:

```bash
mvn test
```

This command was executed from the backend module directory:

```text
backend/
```

## 5.4 Test Implementation Summary

### 5.4.1 AuthServiceImplTest

This class validates registration and authentication logic. It confirms that:

- a valid registration request creates a user successfully,
- a duplicate email is rejected with `EmailAlreadyExistsException`,
- a valid login returns a populated `LoginResponse` with a JWT token.

**Test methods:**

- `register_Success()`
- `register_EmailAlreadyExists()`
- `login_Success()`

### 5.4.2 ActivityServiceImplTest

This class validates activity creation and scheduling constraints. It confirms that:

- a valid activity request is persisted and returned as an `ActivityResponse`,
- an invalid time range triggers a `ResponseStatusException`.

To keep the tests stable over time, the scheduling inputs are defined using **future-relative dates** rather than hard-coded calendar dates.

**Test methods:**

- `createActivity_Success()`
- `createActivity_InvalidTime_ThrowsException()`

### 5.4.3 QuizServiceImplTest

This class validates the AI quiz generation workflow. It confirms that:

- a valid JSON payload returned by `GeminiService` is parsed into structured questions,
- malformed JSON triggers a controlled `ResponseStatusException`.

**Test methods:**

- `generateAIQuestions_Success()`
- `generateAIQuestions_Failure()`

### 5.4.4 UserServiceImplTest

This class validates user retrieval and deletion operations. It confirms that:

- a valid ID returns a `UserDto`,
- an unknown ID throws `UserNotFoundException`,
- deleting a user triggers both repository deletion and audit logging.

**Test methods:**

- `getUserById_Success()`
- `getUserById_NotFound()`
- `deleteUser_Success()`

### 5.4.5 AdminServiceImplTest

This class validates administrative lookup operations. It confirms that:

- all registered users can be retrieved as DTOs,
- region lookup behaves correctly even when the database is empty.

**Test methods:**

- `getAllUsers_Success()`
- `getRegions_Success()`

### 5.4.6 AuditServiceImplTest

This class validates audit logging and history lookup. It confirms that:

- a numeric identifier is resolved as a user ID,
- an email identifier is resolved to a user before querying logs,
- a new action log entry is persisted correctly.

**Test methods:**

- `getUserHistory_ByUserId_Success()`
- `getUserHistory_ByEmail_Success()`
- `logAction_Success()`

## 5.5 Master Test Scenario Summary

| Test ID | Service | Test Method | Scenario Type | Expected Result | Status |
| :--- | :--- | :--- | :---: | :--- | :---: |
| `TC-AUTH-01` | `AuthServiceImpl` | `register_Success` | Nominal | User is registered and saved | PASS |
| `TC-AUTH-02` | `AuthServiceImpl` | `register_EmailAlreadyExists` | Exception | `EmailAlreadyExistsException` is thrown | PASS |
| `TC-AUTH-03` | `AuthServiceImpl` | `login_Success` | Nominal | JWT token is returned | PASS |
| `TC-ACT-01` | `ActivityServiceImpl` | `createActivity_Success` | Nominal | Activity is created and persisted | PASS |
| `TC-ACT-02` | `ActivityServiceImpl` | `createActivity_InvalidTime_ThrowsException` | Exception | `ResponseStatusException` is thrown | PASS |
| `TC-QUIZ-01` | `QuizServiceImpl` | `generateAIQuestions_Success` | Nominal | Valid question list is returned | PASS |
| `TC-QUIZ-02` | `QuizServiceImpl` | `generateAIQuestions_Failure` | Exception | `ResponseStatusException` is thrown | PASS |
| `TC-USER-01` | `UserServiceImpl` | `getUserById_Success` | Nominal | Correct `UserDto` is returned | PASS |
| `TC-USER-02` | `UserServiceImpl` | `getUserById_NotFound` | Exception | `UserNotFoundException` is thrown | PASS |
| `TC-USER-03` | `UserServiceImpl` | `deleteUser_Success` | Nominal | User is deleted and logged | PASS |
| `TC-ADMIN-01` | `AdminServiceImpl` | `getAllUsers_Success` | Nominal | List of users is returned | PASS |
| `TC-ADMIN-02` | `AdminServiceImpl` | `getRegions_Success` | Nominal | Empty region list is handled correctly | PASS |
| `TC-AUDIT-01` | `AuditServiceImpl` | `getUserHistory_ByUserId_Success` | Nominal | History is retrieved by ID | PASS |
| `TC-AUDIT-02` | `AuditServiceImpl` | `getUserHistory_ByEmail_Success` | Nominal | History query is resolved by email | PASS |
| `TC-AUDIT-03` | `AuditServiceImpl` | `logAction_Success` | Nominal | Action log is saved | PASS |

## 5.6 Test Execution Results

The following results were generated from the Surefire reports after a successful `mvn test` execution.

### 5.6.1 Per-Class Results

| Test Class | Tests Run | Failures | Errors | Skipped | Time Elapsed |
| :--- | :---: | :---: | :---: | :---: | ---: |
| `ActivityServiceImplTest` | 2 | 0 | 0 | 0 | 1.628 s |
| `AdminServiceImplTest` | 2 | 0 | 0 | 0 | 0.127 s |
| `AuditServiceImplTest` | 3 | 0 | 0 | 0 | 0.096 s |
| `AuthServiceImplTest` | 3 | 0 | 0 | 0 | 0.224 s |
| `QuizServiceImplTest` | 2 | 0 | 0 | 0 | 0.406 s |
| `UserServiceImplTest` | 3 | 0 | 0 | 0 | 0.013 s |

### 5.6.2 Aggregated Summary

| Metric | Value |
| :--- | :--- |
| **Total Test Classes** | 6 |
| **Total Tests Run** | 15 |
| **Total Failures** | 0 |
| **Total Errors** | 0 |
| **Total Skipped** | 0 |
| **Pass Rate** | 100% |
| **Surefire Class Time Sum** | 2.494 s |
| **Full Maven Build Time** | 4.894 s |

### 5.6.3 Raw Surefire Output

```text
-------------------------------------------------------------------------------
Test set: com.inspector.platform.service.impl.ActivityServiceImplTest
-------------------------------------------------------------------------------
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.628 s -- in com.inspector.platform.service.impl.ActivityServiceImplTest

-------------------------------------------------------------------------------
Test set: com.inspector.platform.service.impl.AdminServiceImplTest
-------------------------------------------------------------------------------
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.127 s -- in com.inspector.platform.service.impl.AdminServiceImplTest

-------------------------------------------------------------------------------
Test set: com.inspector.platform.service.impl.AuditServiceImplTest
-------------------------------------------------------------------------------
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.096 s -- in com.inspector.platform.service.impl.AuditServiceImplTest

-------------------------------------------------------------------------------
Test set: com.inspector.platform.service.impl.AuthServiceImplTest
-------------------------------------------------------------------------------
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.224 s -- in com.inspector.platform.service.impl.AuthServiceImplTest

-------------------------------------------------------------------------------
Test set: com.inspector.platform.service.impl.QuizServiceImplTest
-------------------------------------------------------------------------------
Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.406 s -- in com.inspector.platform.service.impl.QuizServiceImplTest

-------------------------------------------------------------------------------
Test set: com.inspector.platform.service.impl.UserServiceImplTest
-------------------------------------------------------------------------------
Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.013 s -- in com.inspector.platform.service.impl.UserServiceImplTest
```

## 5.7 Coverage Analysis

### 5.7.1 Test Type Distribution

| Test Type | Count | Percentage |
| :--- | :---: | :---: |
| Nominal Path | 10 | 66.7% |
| Exception Path | 5 | 33.3% |
| **Total** | **15** | **100%** |

### 5.7.2 Exceptions Verified

| Exception | Service | Verified By |
| :--- | :--- | :--- |
| `EmailAlreadyExistsException` | `AuthServiceImpl` | `register_EmailAlreadyExists()` |
| `ResponseStatusException` | `ActivityServiceImpl` | `createActivity_InvalidTime_ThrowsException()` |
| `ResponseStatusException` | `QuizServiceImpl` | `generateAIQuestions_Failure()` |
| `UserNotFoundException` | `UserServiceImpl` | `getUserById_NotFound()` |

### 5.7.3 Layer Isolation Through Mocks

| Test Class | Number of Mocks |
| :--- | :---: |
| `AuthServiceImplTest` | 10 |
| `ActivityServiceImplTest` | 8 |
| `QuizServiceImplTest` | 8 |
| `UserServiceImplTest` | 2 |
| `AdminServiceImplTest` | 5 |
| `AuditServiceImplTest` | 7 |
| **Total** | **40** |

## 5.8 Conclusion

The backend unit testing phase confirms that the Inspector Platform service layer is validated with a disciplined and professional approach. All **15 tests** passed successfully across **6 service classes**, with complete dependency isolation through Mockito and automated execution through Maven Surefire.

The suite demonstrates balanced coverage between success scenarios and exception scenarios, while explicitly validating critical business rules such as duplicate-email rejection, schedule consistency, AI parsing resilience, and audit trace creation. Because the tests are isolated and fast, they also provide a reliable safety net for future maintenance and continuous integration.
