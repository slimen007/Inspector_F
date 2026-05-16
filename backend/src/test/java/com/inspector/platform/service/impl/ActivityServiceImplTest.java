package com.inspector.platform.service.impl;

import com.inspector.platform.dto.ActivityRequest;
import com.inspector.platform.dto.ActivityResponse;
import com.inspector.platform.entity.Activity;
import com.inspector.platform.entity.User;
import com.inspector.platform.repository.*;
import com.inspector.platform.service.LogService;
import com.inspector.platform.service.NotificationService;
import com.inspector.platform.service.OnlineMeetingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ActivityServiceImplTest {

    @Mock
    private ActivityRepository activityRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private TeacherProfileRepository teacherProfileRepository;
    @Mock
    private ActivityReportRepository activityReportRepository;
    @Mock
    private OnlineMeetingService onlineMeetingService;
    @Mock
    private InspectorProfileRepository inspectorProfileRepository;
    @Mock
    private NotificationService notificationService;
    @Mock
    private LogService logService;

    @InjectMocks
    private ActivityServiceImpl activityService;

    @Test
    void createActivity_Success() {
        Long inspectorId = 1L;
        ActivityRequest request = new ActivityRequest();
        request.setTitle("Meeting");
        LocalDateTime start = LocalDateTime.now().plusDays(1).withHour(10).withMinute(0).withSecond(0).withNano(0);
        request.setStartDateTime(start);
        request.setEndDateTime(start.plusHours(1));
        request.setOnline(false);

        User inspector = User.builder().id(inspectorId).build();
        when(userRepository.findById(inspectorId)).thenReturn(Optional.of(inspector));
        
        Activity saved = Activity.builder().id(1L).title("Meeting").inspector(inspector).build();
        when(activityRepository.save(any(Activity.class))).thenReturn(saved);

        ActivityResponse response = activityService.createActivity(inspectorId, request);

        assertNotNull(response);
        assertEquals("Meeting", response.getTitle());
        verify(activityRepository).save(any(Activity.class));
    }

    @Test
    void createActivity_InvalidTime_ThrowsException() {
        Long inspectorId = 1L;
        ActivityRequest request = new ActivityRequest();
        LocalDateTime start = LocalDateTime.now().plusDays(1).withHour(12).withMinute(0).withSecond(0).withNano(0);
        request.setStartDateTime(start);
        request.setEndDateTime(start.minusHours(1)); // Start after end

        User inspector = User.builder().id(inspectorId).build();
        when(userRepository.findById(inspectorId)).thenReturn(Optional.of(inspector));

        assertThrows(ResponseStatusException.class, () -> activityService.createActivity(inspectorId, request));
    }
}
