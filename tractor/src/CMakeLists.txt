add_subdirectory(core)
add_subdirectory(gui)

add_executable(tractor main.cpp)

target_link_libraries(tractor
	PRIVATE
		core
		gui
)

target_include_directories(tractor
	PRIVATE
		${CMAKE_CURRENT_SOURCE_DIR}/core
		${CMAKE_CURRENT_SOURCE_DIR}/gui
)

add_executable(test_runner test.cpp)

target_link_libraries(test_runner
	PRIVATE
		core
		gui
)

target_include_directories(test_runner
	PRIVATE
		${CMAKE_CURRENT_SOURCE_DIR}/core
		${CMAKE_CURRENT_SOURCE_DIR}/gui
)
