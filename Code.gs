/**
 * 무순 키우기 관찰기 웹앱 — 백엔드 (Google Apps Script)
 *
 * 이 스크립트는 하나의 "마스터 스프레드시트"에 바인딩되어 실행됩니다.
 * 마스터 스프레드시트에는 아래 두 개의 시트(탭)가 있습니다.
 *   - 교사계정 : 교사ID, 비밀번호(해시), 이름, 학교, 스프레드시트ID, 스프레드시트URL, 사진폴더ID, 생성일시
 *   - 학생명단 : 학생ID, 비밀번호(해시), 이름, 반, 교사ID, 등록일시
 *
 * 교사가 회원가입하면(registerTeacher), 그 교사만을 위한 "기록 스프레드시트"와
 * "사진 폴더"가 자동으로 하나씩 생성되고, 학생이 매일 제출하는 기록은 그 교사의
 * 기록 스프레드시트에 쌓입니다. (교사 1인당 시트 1개 자동 생성)
 *
 * 처음 사용하는 방법은 README.md를 참고하세요.
 */

// ===================== 공통 설정 =====================

var TEACHER_SHEET_NAME = '교사계정';
var STUDENT_SHEET_NAME = '학생명단';
var RECORD_SHEET_NAME = '기록';
var MAX_TEXT_LENGTH = 500; // 텍스트 항목 최대 글자수
var TIMEZONE = 'Asia/Seoul';

// 교사계정 시트 컬럼 인덱스 (0부터 시작)
var T_COL = {
  ID: 0,
  PW_HASH: 1,
  NAME: 2,
  SCHOOL: 3,
  SHEET_ID: 4,
  SHEET_URL: 5,
  FOLDER_ID: 6,
  CREATED_AT: 7
};

// 학생명단 시트 컬럼 인덱스
var S_COL = {
  ID: 0,
  PW_HASH: 1,
  NAME: 2,
  CLASS: 3,
  TEACHER_ID: 4,
  CREATED_AT: 5
};

// 기록 시트(교사별 스프레드시트) 컬럼 인덱스
var R_COL = {
  DATE: 0,
  STUDENT_ID: 1,
  NAME: 2,
  CLASS: 3,
  PHOTO_URL: 4,
  DID_WORK: 5,
  OBSERVATION: 6,
  FEELING: 7,
  SUBMITTED_AT: 8
};

// ===================== 초기 설정 (최초 1회 수동 실행) =====================

/**
 * 스크립트 편집기에서 이 함수를 최초 1회 직접 실행하세요.
 * 마스터 스프레드시트에 필요한 시트(탭)와 머리글을 만들어 줍니다.
 */
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.getActive();

  var teacherSheet = ss.getSheetByName(TEACHER_SHEET_NAME) || ss.insertSheet(TEACHER_SHEET_NAME);
  teacherSheet.clear();
  teacherSheet.appendRow(['교사ID', '비밀번호(해시)', '이름', '학교', '스프레드시트ID', '스프레드시트URL', '사진폴더ID', '생성일시']);
  teacherSheet.setFrozenRows(1);

  var studentSheet = ss.getSheetByName(STUDENT_SHEET_NAME) || ss.insertSheet(STUDENT_SHEET_NAME);
  studentSheet.clear();
  studentSheet.appendRow(['학생ID', '비밀번호(해시)', '이름', '반', '교사ID', '등록일시']);
  studentSheet.setFrozenRows(1);

  // 스프레드시트를 새로 만들 때 기본 생성되는 빈 시트(Sheet1/시트1)는 필요 없으므로 정리
  var defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1');
  if (defaultSheet && ss.getSheets().length > 2) {
    ss.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.getUi().alert(
    '초기 설정이 완료되었습니다.\n\n다음 순서로 진행하세요:\n' +
    '1) 상단 메뉴 [배포 > 새 배포]로 웹 앱을 배포합니다.\n' +
    '   (실행 계정: 나, 액세스 권한: 링크가 있는 모든 사용자)\n' +
    '2) 배포된 주소로 접속해 [교사 회원가입]으로 첫 교사 계정을 만듭니다.\n' +
    '3) 교사 화면에서 학생 계정을 등록합니다.'
  );
}

/**
 * 스프레드시트를 열 때 관리용 메뉴를 추가합니다.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('무순앱 관리')
    .addItem('초기 설정 실행', 'initializeSpreadsheet')
    .addToUi();
}

// ===================== 웹앱 라우팅 =====================

function doGet(e) {
  try {
    var page = (e && e.parameter && e.parameter.page) || 'login';
    var allowed = { login: 'Login', student: 'Student', teacher: 'Teacher' };
    var file = allowed[page] || 'Login';

    var tmpl = HtmlService.createTemplateFromFile(file);
    // 화면 이동(goToPage)에서 window.top의 현재 주소를 직접 읽으려다
    // 크로스 오리진 오류로 엉뚱한 곳으로 이동하는 문제를 막기 위해,
    // 배포된 웹앱의 정확한 주소를 서버에서 미리 계산해 화면에 심어준다.
    tmpl.appUrl = ScriptApp.getService().getUrl();
    return tmpl
      .evaluate()
      .setTitle('무순 키우기 관찰기')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    // 화면이 하얗게만 뜨는 대신, 실제 오류 내용이 그대로 보이도록 한다.
    return HtmlService.createHtmlOutput(
      '<pre style="white-space:pre-wrap; font-family:monospace; padding:20px; font-size:14px;">' +
      '오류 발생: ' + (err && err.message ? err.message : err) + '\n\n' +
      (err && err.stack ? err.stack : '') +
      '</pre>'
    );
  }
}

/** HTML 파일 안에서 다른 HTML 조각(스타일시트 등)을 include 할 때 사용 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ===================== 유틸리티 =====================

function getMasterSS_() {
  return SpreadsheetApp.getActive();
}

function getSheet_(name) {
  var sheet = getMasterSS_().getSheetByName(name);
  if (!sheet) {
    throw new Error('시트를 찾을 수 없습니다: ' + name + ' (initializeSpreadsheet를 먼저 실행했는지 확인하세요)');
  }
  return sheet;
}

function hashPw_(pw) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pw), Utilities.Charset.UTF_8);
  return bytes
    .map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    })
    .join('');
}

function todayStr_() {
  return Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
}

function truncate_(text, max) {
  return String(text || '').slice(0, max);
}

// ===================== 교사 계정 =====================

/**
 * 교사 회원가입. 교사 전용 기록 스프레드시트와 사진 폴더를 자동으로 만든다.
 * payload: {teacherId, password, name, school}
 */
function registerTeacher(payload) {
  if (!payload || !payload.teacherId || !payload.password || !payload.name) {
    return { success: false, message: '교사 ID, 비밀번호, 이름을 모두 입력해주세요.' };
  }

  var sheet = getSheet_(TEACHER_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][T_COL.ID]) === String(payload.teacherId)) {
      return { success: false, message: '이미 사용 중인 교사 ID입니다.' };
    }
  }

  // 이 교사만을 위한 기록 스프레드시트 생성
  var newSs = SpreadsheetApp.create(payload.name + '의 무순 관찰 기록');
  var recordSheet = newSs.getSheets()[0];
  recordSheet.setName(RECORD_SHEET_NAME);
  recordSheet.appendRow(['날짜', '학생ID', '이름', '반', '사진링크', '해준 일', '관찰 내용', '생각/느낌', '제출시각']);
  recordSheet.setFrozenRows(1);
  // '날짜' 열을 텍스트 서식으로 고정해, 구글 시트가 'yyyy-MM-dd' 문자열을
  // 날짜 값으로 자동 변환해버려 하루 1회 제출 체크가 깨지는 것을 방지한다.
  recordSheet.getRange(2, R_COL.DATE + 1, recordSheet.getMaxRows() - 1, 1).setNumberFormat('@');
  DriveApp.getFileById(newSs.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 이 교사만을 위한 사진 폴더 생성
  var folder = DriveApp.createFolder(payload.name + '_무순관찰사진');
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  sheet.appendRow([
    payload.teacherId,
    hashPw_(payload.password),
    payload.name,
    payload.school || '',
    newSs.getId(),
    newSs.getUrl(),
    folder.getId(),
    new Date()
  ]);

  return { success: true, sheetUrl: newSs.getUrl() };
}

function loginTeacher(teacherId, password) {
  var sheet = getSheet_(TEACHER_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][T_COL.ID]) === String(teacherId)) {
      if (data[i][T_COL.PW_HASH] === hashPw_(password)) {
        return {
          success: true,
          teacherId: teacherId,
          name: data[i][T_COL.NAME],
          sheetUrl: data[i][T_COL.SHEET_URL]
        };
      }
      return { success: false, message: '비밀번호가 올바르지 않습니다.' };
    }
  }
  return { success: false, message: '등록되지 않은 교사 ID입니다.' };
}

function getTeacherRow_(teacherId) {
  var sheet = getSheet_(TEACHER_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][T_COL.ID]) === String(teacherId)) return data[i];
  }
  return null;
}

// ===================== 학생 계정 =====================

/**
 * 교사가 학생 계정을 미리 등록한다.
 * studentInfo: {studentId, password, name, class}
 */
function addStudent(teacherId, studentInfo) {
  if (!studentInfo || !studentInfo.studentId || !studentInfo.password || !studentInfo.name) {
    return { success: false, message: '학생 ID, 비밀번호, 이름을 모두 입력해주세요.', studentId: studentInfo && studentInfo.studentId };
  }
  var sheet = getSheet_(STUDENT_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][S_COL.ID]) === String(studentInfo.studentId)) {
      return { success: false, message: '이미 존재하는 학생 ID입니다: ' + studentInfo.studentId, studentId: studentInfo.studentId };
    }
  }
  sheet.appendRow([
    studentInfo.studentId,
    hashPw_(studentInfo.password),
    studentInfo.name,
    studentInfo.class || '',
    teacherId,
    new Date()
  ]);
  return { success: true, studentId: studentInfo.studentId };
}

/** 여러 학생을 한 번에 등록 (rows: [{studentId,password,name,class}, ...]) */
function bulkAddStudents(teacherId, rows) {
  return rows.map(function (r) {
    return addStudent(teacherId, r);
  });
}

function getStudentRow_(studentId) {
  var sheet = getSheet_(STUDENT_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][S_COL.ID]) === String(studentId)) {
      return {
        studentId: data[i][S_COL.ID],
        name: data[i][S_COL.NAME],
        class: data[i][S_COL.CLASS],
        teacherId: data[i][S_COL.TEACHER_ID]
      };
    }
  }
  return null;
}

function getStudentsByTeacher_(teacherId) {
  var sheet = getSheet_(STUDENT_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][S_COL.TEACHER_ID]) === String(teacherId)) {
      list.push({ studentId: data[i][S_COL.ID], name: data[i][S_COL.NAME], class: data[i][S_COL.CLASS] });
    }
  }
  return list;
}

function loginStudent(studentId, password) {
  var sheet = getSheet_(STUDENT_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][S_COL.ID]) === String(studentId)) {
      if (data[i][S_COL.PW_HASH] === hashPw_(password)) {
        return {
          success: true,
          studentId: studentId,
          name: data[i][S_COL.NAME],
          class: data[i][S_COL.CLASS],
          teacherId: data[i][S_COL.TEACHER_ID]
        };
      }
      return { success: false, message: '비밀번호가 올바르지 않습니다.' };
    }
  }
  return { success: false, message: '등록되지 않은 학생 ID입니다. 선생님께 계정 등록을 요청하세요.' };
}

// ===================== 관찰 기록 제출/조회 =====================

function getTeacherRecordSheet_(teacherRow) {
  var recordSs = SpreadsheetApp.openById(teacherRow[T_COL.SHEET_ID]);
  return recordSs.getSheetByName(RECORD_SHEET_NAME);
}

function hasSubmittedToday(studentId) {
  var student = getStudentRow_(studentId);
  if (!student) return { success: false, message: '학생 정보를 찾을 수 없습니다.' };
  var teacherRow = getTeacherRow_(student.teacherId);
  if (!teacherRow) return { success: false, message: '담당 교사 정보를 찾을 수 없습니다.' };

  var sheet = getTeacherRecordSheet_(teacherRow);
  var data = sheet.getDataRange().getValues();
  var today = todayStr_();
  var target = normalizeForCompare_(studentId);
  for (var i = 1; i < data.length; i++) {
    if (normalizeForCompare_(data[i][R_COL.STUDENT_ID]) === target && normalizeForCompare_(data[i][R_COL.DATE]) === today) {
      return { success: true, submitted: true };
    }
  }
  return { success: true, submitted: false };
}

/**
 * 오늘의 관찰 기록 제출 (하루 1회 제한)
 * payload: {studentId, photoBase64, photoMime, didWork, observation, feeling}
 */
function submitRecord(payload) {
  var student = getStudentRow_(payload.studentId);
  if (!student) return { success: false, message: '학생 정보를 찾을 수 없습니다.' };

  var check = hasSubmittedToday(payload.studentId);
  if (!check.success) return check;
  if (check.submitted) {
    return { success: false, message: '오늘은 이미 기록을 제출했습니다. 내일 다시 작성해주세요.' };
  }

  var teacherRow = getTeacherRow_(student.teacherId);
  if (!teacherRow) return { success: false, message: '담당 교사 정보를 찾을 수 없습니다.' };

  var didWork = truncate_(payload.didWork, MAX_TEXT_LENGTH);
  var observation = truncate_(payload.observation, MAX_TEXT_LENGTH);
  var feeling = truncate_(payload.feeling, MAX_TEXT_LENGTH);

  var photoUrl = '';
  if (payload.photoBase64) {
    var folder = DriveApp.getFolderById(teacherRow[T_COL.FOLDER_ID]);
    var blob = Utilities.newBlob(
      Utilities.base64Decode(payload.photoBase64),
      payload.photoMime || 'image/jpeg',
      student.studentId + '_' + todayStr_() + '.jpg'
    );
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    photoUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  }

  var sheet = getTeacherRecordSheet_(teacherRow);
  sheet.appendRow([
    todayStr_(),
    student.studentId,
    student.name,
    student.class,
    photoUrl,
    didWork,
    observation,
    feeling,
    new Date()
  ]);
  SpreadsheetApp.flush();

  return { success: true };
}

function rowToRecord_(row) {
  return {
    date: row[R_COL.DATE],
    studentId: row[R_COL.STUDENT_ID],
    name: row[R_COL.NAME],
    class: row[R_COL.CLASS],
    photoUrl: row[R_COL.PHOTO_URL],
    didWork: row[R_COL.DID_WORK],
    observation: row[R_COL.OBSERVATION],
    feeling: row[R_COL.FEELING]
  };
}

/** 문자열 비교용: 앞뒤 공백/보이지 않는 공백류를 제거하고 비교한다. */
function normalizeForCompare_(v) {
  return String(v == null ? '' : v)
    .replace(/[\s ​﻿]+/g, ' ')
    .trim();
}

/** 학생 본인의 지난 기록 목록 (최신순) */
function getMyRecords(studentId) {
  var student = getStudentRow_(studentId);
  if (!student) return [];
  var teacherRow = getTeacherRow_(student.teacherId);
  if (!teacherRow) return [];
  var sheet = getTeacherRecordSheet_(teacherRow);
  var data = sheet.getDataRange().getValues();
  var target = normalizeForCompare_(studentId);
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (normalizeForCompare_(data[i][R_COL.STUDENT_ID]) === target) {
      list.push(rowToRecord_(data[i]));
    }
  }
  list.reverse();
  return list;
}

/** 같은 반 학생들의 기록 목록 (최신순) */
function getClassRecords(studentId) {
  var student = getStudentRow_(studentId);
  if (!student) return [];
  var teacherRow = getTeacherRow_(student.teacherId);
  if (!teacherRow) return [];
  var sheet = getTeacherRecordSheet_(teacherRow);
  var data = sheet.getDataRange().getValues();
  var target = normalizeForCompare_(student.class);
  var list = [];
  for (var i = 1; i < data.length; i++) {
    if (normalizeForCompare_(data[i][R_COL.CLASS]) === target) {
      list.push(rowToRecord_(data[i]));
    }
  }
  list.reverse();
  return list;
}

/**
 * [진단용] "나의 기록"/"같은 반 기록"이 비어 보이는 문제를 원인 파악하기 위한 함수.
 *
 * 사용법:
 * 1) 아래 studentId 값을 확인하려는 실제 학생 ID로 바꾼다.
 * 2) 앱스 스크립트 편집기 상단에서 실행할 함수로 "debugMyRecords"를 선택하고 ▶ 실행 버튼을 누른다.
 * 3) 메뉴 [보기 > 실행 로그] (또는 Ctrl+Enter)로 결과를 확인해서 알려주면 원인을 정확히 찾을 수 있다.
 */
function debugMyRecords() {
  var studentId = '여기에_학생ID_입력'; // ← 실제 학생 ID로 바꿔서 실행하세요

  var student = getStudentRow_(studentId);
  Logger.log('1) 학생 조회 결과: ' + JSON.stringify(student));
  if (!student) {
    Logger.log('-> 학생명단 시트에서 이 학생ID를 찾지 못했습니다. 철자/공백을 확인하세요.');
    return;
  }

  var teacherRow = getTeacherRow_(student.teacherId);
  Logger.log('2) 담당 교사ID: ' + student.teacherId + ' / 교사 조회 결과: ' + (teacherRow ? '찾음' : 'null'));
  if (!teacherRow) {
    Logger.log('-> 교사계정 시트에서 담당 교사를 찾지 못했습니다.');
    return;
  }
  Logger.log('   교사 기록 스프레드시트 URL: ' + teacherRow[T_COL.SHEET_URL]);

  var sheet = getTeacherRecordSheet_(teacherRow);
  if (!sheet) {
    Logger.log('-> 기록 시트를 찾지 못했습니다. (시트 이름이 "기록"이 맞는지 확인)');
    return;
  }

  var data = sheet.getDataRange().getValues();
  Logger.log('3) 기록 시트 전체 행 수(헤더 포함): ' + data.length);

  var target = normalizeForCompare_(studentId);
  Logger.log('4) 비교 대상 studentId = [' + studentId + '] (길이 ' + studentId.length + ')');

  for (var i = 1; i < data.length; i++) {
    var raw = data[i][R_COL.STUDENT_ID];
    var match = normalizeForCompare_(raw) === target;
    Logger.log(
      '   행' + (i + 1) + ': STUDENT_ID=[' + raw + '] (길이 ' + String(raw).length + ', 타입 ' + typeof raw + ')' +
      ' / DATE=[' + data[i][R_COL.DATE] + ']' +
      ' / CLASS=[' + data[i][R_COL.CLASS] + ']' +
      ' → 일치여부: ' + match
    );
  }
}

/** 교사 대시보드: 우리 반 학생 목록 + 오늘 제출 여부 + 기록 시트 링크 */
function getTeacherDashboard(teacherId) {
  var students = getStudentsByTeacher_(teacherId);
  var teacherRow = getTeacherRow_(teacherId);
  if (!teacherRow) return { students: [], sheetUrl: '' };

  var sheet = getTeacherRecordSheet_(teacherRow);
  var data = sheet.getDataRange().getValues();
  var today = todayStr_();
  var submittedToday = {};
  for (var i = 1; i < data.length; i++) {
    if (data[i][R_COL.DATE] === today) {
      submittedToday[String(data[i][R_COL.STUDENT_ID])] = true;
    }
  }

  var list = students.map(function (s) {
    return {
      studentId: s.studentId,
      name: s.name,
      class: s.class,
      submittedToday: !!submittedToday[String(s.studentId)]
    };
  });

  return { students: list, sheetUrl: teacherRow[T_COL.SHEET_URL] };
}
