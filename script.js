
(() => {
    "use strict";

    const API_BASE = "http://127.0.0.1:2200";

    const form = document.getElementById("predict-form");
    const submitBtn = document.getElementById("submit-btn");
    const resetBtn = document.getElementById("reset-btn");
    const errorRetryBtn = document.getElementById("error-retry-btn");

    const stateIdle = document.getElementById("state-idle");
    const stateLoading = document.getElementById("state-loading");
    const stateResult = document.getElementById("state-result");
    const stateError = document.getElementById("state-error");

    const scoreNumberEl = document.getElementById("score-number");
    const scoreBandEl = document.getElementById("score-band");
    const scoreContextEl = document.getElementById("score-context");
    const errorCopyEl = document.getElementById("error-copy");

    const stressGroup = document.getElementById("stress_level_group");
    const stressInput = document.getElementById("stress_level");

    function showState(name) {
        const states = {
            idle: stateIdle,
            loading: stateLoading,
            result: stateResult,
            error: stateError
        };

        Object.values(states).forEach((element) => {
            if (element) element.hidden = true;
        });

        if (states[name]) states[name].hidden = false;
    }

    function setFieldError(input, message) {
        const wrapper = input?.closest(".field");
        if (!wrapper) return;

        wrapper.classList.add("field-error");

        const messageElement = wrapper.querySelector(".error-msg");

        if (messageElement) {
            messageElement.textContent = message;
        }
    }

    function clearFieldError(input) {
        const wrapper = input?.closest(".field");
        if (!wrapper) return;

        wrapper.classList.remove("field-error");

        const messageElement = wrapper.querySelector(".error-msg");

        if (messageElement) {
            messageElement.textContent = "";
        }
    }

    function clearAllErrors() {
        form.querySelectorAll(".field").forEach((field) => {
            field.classList.remove("field-error");
        });

        form.querySelectorAll(".error-msg").forEach((message) => {
            message.textContent = "";
        });
    }

    if (stressGroup && stressInput) {
        stressGroup.querySelectorAll(".seg-btn").forEach((button) => {
            button.addEventListener("click", () => {
                stressGroup.querySelectorAll(".seg-btn").forEach((item) => {
                    item.classList.remove("active");
                    item.setAttribute("aria-pressed", "false");
                });

                button.classList.add("active");
                button.setAttribute("aria-pressed", "true");
                stressInput.value = button.dataset.value;

                clearFieldError(stressInput);
            });
        });
    }

    function collectPayload() {
        const data = new FormData(form);

        return {
            age: Number(data.get("age")),
            gender: data.get("gender") || "",
            country: (data.get("country") || "").trim(),
            academic_level: data.get("academic_level") || "",
            most_used_platform: data.get("most_used_platform") || "",
            purpose_of_use: data.get("purpose_of_use") || "",
            avg_daily_usage_hours: Number(data.get("avg_daily_usage_hours")),
            daily_unlocks: Number(data.get("daily_unlocks")),
            study_hours: Number(data.get("study_hours")),
            physical_activity_hours: Number(data.get("physical_activity_hours")),
            sleep_hours_per_night: Number(data.get("sleep_hours_per_night")),
            stress_level: data.get("stress_level") || ""
        };
    }

    function validate(payload) {
        const errors = [];

        const numericFields = [
            ["age", 10, 100, true],
            ["avg_daily_usage_hours", 0, 24, false],
            ["daily_unlocks", 0, Infinity, true],
            ["study_hours", 0, 24, false],
            ["physical_activity_hours", 0, 24, false],
            ["sleep_hours_per_night", 0, 24, false]
        ];

        numericFields.forEach(([key, minimum, maximum, integerOnly]) => {
            const input = document.getElementById(key);
            const value = payload[key];

            if (input.value.trim() === "" || !Number.isFinite(value)) {
                errors.push([input, "Please enter a valid number."]);
            } else if (value < minimum || value > maximum) {
                errors.push([input, "Please enter a valid value."]);
            } else if (integerOnly && !Number.isInteger(value)) {
                errors.push([input, "Please enter a whole number."]);
            }
        });

        [
            "gender",
            "country",
            "academic_level",
            "most_used_platform",
            "purpose_of_use"
        ].forEach((key) => {
            const input = document.getElementById(key);

            if (!payload[key]) {
                errors.push([input, "This field is required."]);
            }
        });

        if (!payload.stress_level) {
            errors.push([stressInput, "Please select a stress level."]);
        }

        return errors;
    }

    function bandFor(score) {
        if (score < 4) {
            return {
                label: "Signal: strained",
                context: "Your responses suggest elevated strain. Consider reviewing your sleep, activity and screen-time habits."
            };
        }

        if (score < 7) {
            return {
                label: "Signal: balanced",
                context: "Your predicted score is in the middle range. There may be room to improve your daily routine."
            };
        }

        return {
            label: "Signal: strong",
            context: "Your predicted score is in the higher range. Continue maintaining healthy daily habits."
        };
    }

    function renderResult(score) {
        const displayedScore = Math.max(0, Math.min(10, score));
        const result = bandFor(displayedScore);

        scoreNumberEl.textContent = displayedScore.toFixed(2);
        scoreBandEl.textContent = result.label;
        scoreContextEl.textContent = result.context;

        showState("result");
    }

    function renderError(message) {
        errorCopyEl.textContent = message;
        showState("error");
    }

    function applyServerErrors(detail) {
        if (!Array.isArray(detail)) return false;

        let found = false;

        detail.forEach((error) => {
            const field = error.loc?.[error.loc.length - 1];

            const input = field === "stress_level"
                ? stressInput
                : document.getElementById(field);

            if (input) {
                setFieldError(input, error.msg || "Invalid input.");
                found = true;
            }
        });

        return found;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearAllErrors();

        const payload = collectPayload();
        const errors = validate(payload);

        if (errors.length > 0) {
            errors.forEach(([input, message]) => {
                setFieldError(input, message);
            });

            errors[0][0]?.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.classList.add("loading");
        showState("loading");

        try {
            const response = await fetch(`${API_BASE}/predict`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.status === 422) {
                applyServerErrors(result.detail);
                renderError("Please check the highlighted input fields.");
                return;
            }

            if (!response.ok) {
                renderError(
                    typeof result.detail === "string"
                        ? result.detail
                        : `Server error: ${response.status}`
                );
                return;
            }

            const score = Number(result.predicted_mental_health_score);

            if (!Number.isFinite(score)) {
                renderError("The server returned an invalid prediction.");
                return;
            }

            renderResult(score);

        } catch (error) {
            console.error("Prediction request failed:", error);

            renderError(
                "Unable to communicate with the prediction server. Please check that FastAPI is running on port 2200."
            );

        } finally {
            submitBtn.disabled = false;
            submitBtn.classList.remove("loading");
        }
    });

    form.querySelectorAll("input, select").forEach((element) => {
        element.addEventListener("input", () => clearFieldError(element));
        element.addEventListener("change", () => clearFieldError(element));
    });

    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            showState("idle");
        });
    }

    if (errorRetryBtn) {
        errorRetryBtn.addEventListener("click", () => {
            showState("idle");
        });
    }

})();
