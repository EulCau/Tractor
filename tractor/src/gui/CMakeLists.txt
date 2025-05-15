file(GLOB GUI_SOURCES CONFIGURE_DEPENDS *.cpp *.hpp)

add_library(gui STATIC ${GUI_SOURCES})

target_include_directories(gui PUBLIC ${CMAKE_CURRENT_SOURCE_DIR})
