# Step 1: Use an official Python runtime as a parent image
# Using a '''slim''' image reduces the final image size. Python 3.11 is a good modern choice.
FROM python:3.11-slim

# Step 2: Set the working directory in the container
WORKDIR /app

# Step 3: Copy the requirements file and install dependencies
# This is done in a separate step to leverage Docker's layer caching.
# If requirements.txt doesn't change, this layer won't be re-run on subsequent builds.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Step 4: Copy the rest of the application's code into the container
COPY . .

# Step 5: Expose the port the app runs on
# The main.py script is configured to use the PORT environment variable, defaulting to 8000.
# Fly.io will automatically set this variable and handle mapping.
EXPOSE 8000

# Step 6: Define the command to run the application
# This tells Docker how to start the app.
CMD ["python", "main.py"]
