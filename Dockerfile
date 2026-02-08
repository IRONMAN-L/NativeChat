FROM node:23-bookworm

# Set environment variables for Android SDK and Java
ENV ANDROID_HOME="/opt/android-sdk" \
    ANDROID_NDK_HOME="/opt/android-sdk/ndk/28.0.12433544" \
    JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"

# Add binaries to PATH so you can use 'adb', 'sdkmanager', etc.
ENV PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/35.0.0"

# 3. Install JDK 17 and dependencies
RUN apt-get update && apt-get install -y \
    openjdk-17-jdk \
    unzip \
    wget \
    git \
    cmake \
    ninja-build \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# 4. Download Android Command Line Tools
WORKDIR /opt/android-sdk
RUN wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip \
    && unzip cmdline-tools.zip \
    && mkdir cmdline-tools/latest \
    && mv cmdline-tools/bin cmdline-tools/latest/ \
    && mv cmdline-tools/lib cmdline-tools/latest/ \
    && rm cmdline-tools.zip

# 5. Accept Licenses & Install SDK Packages
# We install 'platform-tools' (adb) and specific build-tools you might need
RUN yes | sdkmanager --licenses \
    && sdkmanager "platform-tools" \
        "platforms;android-35" \
        "build-tools;35.0.0" \
        "ndk;28.0.12433566" \
        "cmake;3.22.1"

# 6. Setup Workspace
WORKDIR /app

# 7. Optimize Build: Cache dependencies
COPY package*.json ./
RUN npm install
RUN npm install -g eas-cli
# copy files
COPY . .

# expose Metro Bundler ports
EXPOSE 8081 19000 19001 19002

# Start the development server
CMD ["npx", "expo", "start", "--host", "lan"]